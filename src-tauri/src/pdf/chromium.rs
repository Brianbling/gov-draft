// src-tauri/src/pdf/chromium.rs
use std::path::Path;

/// 探测可用的 Chromium 二进制路径。
/// 顺序:preferred(用户指定) → CHROME / CHROMIUM_PATH 环境变量 → 平台候选列表。
pub fn detect(preferred: Option<&str>) -> Option<String> {
    resolve(
        preferred,
        &|k| std::env::var(k).ok(),
        &platform_candidates(),
        &|p| Path::new(p).exists(),
    )
}

fn resolve(
    preferred: Option<&str>,
    env: &dyn Fn(&str) -> Option<String>,
    candidates: &[String],
    exists: &dyn Fn(&str) -> bool,
) -> Option<String> {
    if let Some(p) = preferred {
        if !p.is_empty() && exists(p) {
            return Some(p.to_string());
        }
    }
    for key in ["CHROME", "CHROMIUM_PATH"] {
        if let Some(v) = env(key) {
            if !v.is_empty() && exists(&v) {
                return Some(v);
            }
        }
    }
    first_existing(candidates, exists)
}

fn first_existing(candidates: &[String], exists: &dyn Fn(&str) -> bool) -> Option<String> {
    candidates.iter().find(|c| exists(c)).cloned()
}

#[cfg(target_os = "windows")]
fn platform_candidates() -> Vec<String> {
    let pf = std::env::var("ProgramFiles").ok();
    let pf86 = std::env::var("ProgramFiles(x86)").ok();
    let local = std::env::var("LocalAppData").ok();

    // 可装在 Program Files / Program Files (x86) / LocalAppData 任一处的浏览器,
    // 相对可执行路径,按偏好排序。
    let multi = [
        r"\Google\Chrome\Application\chrome.exe",
        r"\Google\Chrome Beta\Application\chrome.exe",
        r"\Google\Chrome Dev\Application\chrome.exe",
        r"\Chromium\Application\chrome.exe",
        r"\Microsoft\Edge\Application\msedge.exe",
        r"\BraveSoftware\Brave-Browser\Application\brave.exe",
    ];
    let mut out = Vec::new();
    for base in [&pf, &pf86, &local] {
        if let Some(b) = base {
            for rest in multi {
                out.push(format!("{b}{rest}"));
            }
        }
    }
    // Chrome Canary(SxS)只装在 LocalAppData。
    if let Some(l) = &local {
        out.push(format!(r"{l}\Google\Chrome SxS\Application\chrome.exe"));
    }
    out
}

#[cfg(target_os = "macos")]
fn platform_candidates() -> Vec<String> {
    // .app 内的可执行相对路径,按偏好排序。
    let apps = [
        "Google Chrome.app/Contents/MacOS/Google Chrome",
        "Chromium.app/Contents/MacOS/Chromium",
        "Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
        "Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "Brave Browser.app/Contents/MacOS/Brave Browser",
    ];
    // 系统级 /Applications 与用户级 ~/Applications(无管理员权限时的常见安装位置)。
    let mut bases = vec!["/Applications".to_string()];
    if let Ok(home) = std::env::var("HOME") {
        bases.push(format!("{home}/Applications"));
    }
    let mut out = Vec::new();
    for base in &bases {
        for app in apps {
            out.push(format!("{base}/{app}"));
        }
    }
    out
}

#[cfg(all(unix, not(target_os = "macos")))]
fn platform_candidates() -> Vec<String> {
    // 常见可执行名,按偏好排序。
    let names = [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "google-chrome-beta",
        "google-chrome-unstable",
        "microsoft-edge",
        "microsoft-edge-stable",
        "brave-browser",
    ];
    let mut out = Vec::new();
    // 1. 遍历 PATH。
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(':') {
            if dir.is_empty() {
                continue;
            }
            for name in names {
                out.push(format!("{dir}/{name}"));
            }
        }
    }
    // 2. 硬编码绝对路径:GUI 应用从桌面启动器启动时 PATH 常被裁剪成
    //    /usr/bin:/bin,不含发行版/snap 的实际安装位置,故不依赖 PATH 再兜一层。
    for abs in [
        "/opt/google/chrome/chrome",
        "/opt/google/chrome-beta/chrome",
        "/opt/google/chrome-unstable/chrome",
        "/opt/microsoft/msedge/msedge",
        "/opt/brave.com/brave/brave-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
        "/usr/local/bin/chrome",
        "/usr/local/bin/chromium",
        "/snap/bin/chromium",
    ] {
        out.push(abs.to_string());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preferred_path_wins_when_it_exists() {
        let got = resolve(
            Some("/opt/chrome"),
            &|_| Some("/env/chrome".into()),
            &["/cand/chrome".into()],
            &|p| p == "/opt/chrome",
        );
        assert_eq!(got, Some("/opt/chrome".to_string()));
    }

    #[test]
    fn preferred_ignored_when_missing_falls_back_to_env() {
        let got = resolve(
            Some("/opt/missing"),
            &|k| (k == "CHROME").then(|| "/env/chrome".to_string()),
            &["/cand/chrome".into()],
            &|p| p == "/env/chrome",
        );
        assert_eq!(got, Some("/env/chrome".to_string()));
    }

    #[test]
    fn falls_back_to_first_existing_candidate() {
        let got = resolve(
            None,
            &|_| None,
            &["/a/chrome".into(), "/b/chrome".into()],
            &|p| p == "/b/chrome",
        );
        assert_eq!(got, Some("/b/chrome".to_string()));
    }

    #[test]
    fn returns_none_when_nothing_exists() {
        let got = resolve(None, &|_| None, &["/a".into()], &|_| false);
        assert_eq!(got, None);
    }

    #[test]
    fn empty_preferred_and_empty_env_are_skipped() {
        let got = resolve(
            Some(""),
            &|_| Some(String::new()),
            &["/c/chrome".into()],
            &|p| p == "/c/chrome",
        );
        assert_eq!(got, Some("/c/chrome".to_string()));
    }

    // GUI 启动时 PATH 常被裁剪,硬编码绝对路径必须始终存在,不依赖 PATH。
    #[cfg(all(unix, not(target_os = "macos")))]
    #[test]
    fn linux_candidates_include_hardcoded_absolute_paths() {
        let cands = platform_candidates();
        for expected in [
            "/opt/google/chrome/chrome",
            "/usr/bin/google-chrome",
            "/snap/bin/chromium",
        ] {
            assert!(
                cands.iter().any(|c| c == expected),
                "missing hardcoded candidate: {expected}"
            );
        }
    }
}
