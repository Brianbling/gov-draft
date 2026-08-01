// src-tauri/src/pdf/render.rs
use std::io::Write;
use std::time::Duration;

use chromiumoxide::browser::{Browser, BrowserConfig};
use chromiumoxide::cdp::browser_protocol::page::PrintToPdfParams;
use futures::StreamExt;
use tokio::time::timeout;

use super::chromium;
use super::{ExportPdfArgs, ExportPdfResult, PdfError};

const RENDER_TIMEOUT: Duration = Duration::from_secs(30);

pub async fn export(args: ExportPdfArgs) -> Result<ExportPdfResult, PdfError> {
    let chrome =
        chromium::detect(args.chromium_path.as_deref()).ok_or(PdfError::ChromiumNotFound)?;

    // 1. HTML 写入临时文件,file:// 加载。NamedTempFile 出作用域自动删。
    let mut tmp = tempfile::Builder::new()
        .suffix(".html")
        .tempfile()
        .map_err(|_| PdfError::WriteFailed)?;
    tmp.write_all(args.html.as_bytes())
        .map_err(|_| PdfError::WriteFailed)?;
    tmp.flush().map_err(|_| PdfError::WriteFailed)?;
    let file_url = url::Url::from_file_path(tmp.path())
        .map_err(|_| PdfError::WriteFailed)?
        .to_string();

    // 2. 整个渲染包在超时里。
    let output_path = args.output_path.clone();
    let landscape = args.orientation == "landscape";
    let print_background = args.print_background;

    let bytes = timeout(
        RENDER_TIMEOUT,
        run_headless(
            &chrome,
            &file_url,
            &output_path,
            landscape,
            print_background,
        ),
    )
    .await
    .map_err(|_| PdfError::RenderTimeout)??;

    if bytes == 0 {
        return Err(PdfError::EmptyPdf);
    }
    Ok(ExportPdfResult {
        output_path: args.output_path,
        bytes_written: bytes,
    })
}

async fn run_headless(
    chrome: &str,
    file_url: &str,
    output_path: &str,
    landscape: bool,
    print_background: bool,
) -> Result<u64, PdfError> {
    // 构造 BrowserConfig:自定义可执行文件 + headless(default builder 即 headless)。
    #[allow(unused_mut)]
    let mut builder = BrowserConfig::builder().chrome_executable(chrome);
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        builder = builder.arg("--no-sandbox");
    }
    let config = builder
        .build()
        .map_err(|_| PdfError::ChromiumLaunchFailed)?;

    let (mut browser, mut handler) = Browser::launch(config)
        .await
        .map_err(|_| PdfError::ChromiumLaunchFailed)?;

    // 驱动事件循环;handler 任务在 browser 关闭后自然结束。
    let handle = tokio::spawn(async move {
        while let Some(event) = handler.next().await {
            if event.is_err() {
                break;
            }
        }
    });

    let result = render_page(&browser, file_url, output_path, landscape, print_background).await;

    // 确定性清理:无论成功失败都关浏览器、等 handler 结束。
    let _ = browser.close().await;
    let _ = handle.await;
    result
}

async fn render_page(
    browser: &Browser,
    file_url: &str,
    output_path: &str,
    landscape: bool,
    print_background: bool,
) -> Result<u64, PdfError> {
    let page = browser
        .new_page(file_url)
        .await
        .map_err(|_| PdfError::CdpConnectFailed)?;
    page.wait_for_navigation()
        .await
        .map_err(|_| PdfError::CdpConnectFailed)?;

    // 等 web 字体就绪(阶段一无 @font-face 时立即 resolve,属防御性等待)。
    let _ = page
        .evaluate(
            "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
        )
        .await;

    let params = PrintToPdfParams {
        landscape: Some(landscape),
        print_background: Some(print_background),
        prefer_css_page_size: Some(true),
        margin_top: Some(0.0),
        margin_bottom: Some(0.0),
        margin_left: Some(0.0),
        margin_right: Some(0.0),
        ..Default::default()
    };

    let bytes = page
        .save_pdf(params, output_path)
        .await
        .map_err(|_| PdfError::WriteFailed)?;
    Ok(bytes.len() as u64)
}

#[cfg(test)]
mod integration {
    use super::*;
    use crate::pdf::ExportPdfArgs;

    // 真实端到端:需本机存在 Chromium。默认 ignore,显式运行:
    //   CHROME=<path> cargo test pdf::render -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn exports_real_pdf() {
        let out = std::env::temp_dir().join("ezdoc-e2e-export.pdf");
        let args = ExportPdfArgs {
            html: "<!doctype html><html><body><h1>ezdoc PDF e2e</h1>\
                   <p>headless chromium render test</p></body></html>"
                .into(),
            output_path: out.to_string_lossy().into_owned(),
            chromium_path: std::env::var("CHROME").ok(),
            orientation: "portrait".into(),
            print_background: true,
        };

        let res = export(args).await.expect("export should succeed");
        assert!(res.bytes_written > 0, "pdf should be non-empty");

        let disk = std::fs::read(&out).expect("pdf file should exist");
        assert_eq!(disk.len() as u64, res.bytes_written);
        assert!(disk.starts_with(b"%PDF-"), "output should be a PDF");
        eprintln!("wrote {} bytes to {}", res.bytes_written, out.display());
        let _ = std::fs::remove_file(&out);
    }
}
