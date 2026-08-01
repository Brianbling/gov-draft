use std::time::Duration;

use serde::Deserialize;

const DEFAULT_ENDPOINT: &str = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL: &str = "deepseek-v4-flash";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);
const API_KEY_ENV_VAR: &str = "EZDOC_API_KEY";

#[derive(Debug)]
enum LlmError {
    NoApiKey,
    Timeout,
    Network,
    Http(u16),
    InvalidResponse,
}

impl LlmError {
    fn code(&self) -> String {
        match self {
            LlmError::NoApiKey => "LLM_NO_API_KEY".into(),
            LlmError::Timeout => "LLM_TIMEOUT".into(),
            LlmError::Network => "LLM_NETWORK_ERROR".into(),
            LlmError::Http(code) => format!("LLM_HTTP_{code}"),
            LlmError::InvalidResponse => "LLM_INVALID_RESPONSE".into(),
        }
    }
}

#[derive(Deserialize)]
struct ChatCompletion {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Deserialize)]
struct Message {
    content: Option<String>,
}

#[tauri::command]
pub async fn generate_document(
    prompt: String,
    api_key: Option<String>,
    model: Option<String>,
    endpoint: Option<String>,
) -> Result<String, String> {
    let key = api_key
        .filter(|k| !k.trim().is_empty())
        .or_else(|| {
            std::env::var(API_KEY_ENV_VAR)
                .ok()
                .filter(|k| !k.trim().is_empty())
        })
        .ok_or_else(|| LlmError::NoApiKey.code())?;

    let url = endpoint.unwrap_or_else(|| DEFAULT_ENDPOINT.to_string());
    let model = model.unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let client = reqwest::Client::new();
    let request = client
        .post(&url)
        .header("Authorization", format!("Bearer {key}"))
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a professional government document writer. Respond only with a valid JSON object."
                },
                { "role": "user", "content": prompt }
            ],
            "temperature": 0.3,
            "response_format": { "type": "json_object" }
        }));

    let response = match tokio::time::timeout(REQUEST_TIMEOUT, request.send()).await {
        Ok(Ok(resp)) => resp,
        Ok(Err(_)) => return Err(LlmError::Network.code()),
        Err(_) => return Err(LlmError::Timeout.code()),
    };

    if !response.status().is_success() {
        return Err(LlmError::Http(response.status().as_u16()).code());
    }

    // send() 收到响应头即返回，读 body 必须单独包超时，否则服务端挂起 body 会无限等待。
    let completion: ChatCompletion = match tokio::time::timeout(REQUEST_TIMEOUT, response.json()).await {
        Ok(Ok(completion)) => completion,
        Ok(Err(_)) => return Err(LlmError::InvalidResponse.code()),
        Err(_) => return Err(LlmError::Timeout.code()),
    };

    completion
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| LlmError::InvalidResponse.code())
}
