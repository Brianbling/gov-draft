// src-tauri/src/pdf/mod.rs
mod chromium;
mod render;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy)]
pub enum PdfError {
    ChromiumNotFound,
    ChromiumLaunchFailed,
    CdpConnectFailed,
    RenderTimeout,
    WriteFailed,
    EmptyPdf,
}

impl PdfError {
    pub fn code(&self) -> &'static str {
        match self {
            PdfError::ChromiumNotFound => "CHROMIUM_NOT_FOUND",
            PdfError::ChromiumLaunchFailed => "CHROMIUM_LAUNCH_FAILED",
            PdfError::CdpConnectFailed => "CDP_CONNECT_FAILED",
            PdfError::RenderTimeout => "RENDER_TIMEOUT",
            PdfError::WriteFailed => "WRITE_FAILED",
            PdfError::EmptyPdf => "EMPTY_PDF",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfArgs {
    pub html: String,
    pub output_path: String,
    #[serde(default)]
    pub chromium_path: Option<String>,
    pub orientation: String,
    #[serde(default)]
    pub print_background: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfResult {
    pub output_path: String,
    pub bytes_written: u64,
}

#[tauri::command]
pub async fn detect_chromium() -> Result<Option<String>, String> {
    Ok(chromium::detect(None))
}

#[tauri::command]
pub async fn export_pdf(args: ExportPdfArgs) -> Result<ExportPdfResult, String> {
    render::export(args).await.map_err(|e| e.code().to_string())
}
