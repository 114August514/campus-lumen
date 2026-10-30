//! One-shot OpenAI-compatible chat requests. Credentials are used in memory only.
use std::time::Duration;

use reqwest::{redirect::Policy, Url};
use serde::{Deserialize, Serialize};
use tokio::time::timeout;

use crate::discovery::public_addresses;

pub const AI_WAIT_SECONDS: u64 = 60;
const MAX_RESPONSE_BYTES: usize = 256_000;

#[derive(Clone)]
pub struct AiChatConfig {
    pub base_url: String,
    pub model: String,
    pub api_key: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiChatInput {
    pub task: String,
    #[serde(default)]
    pub public_context: String,
    pub personal_context: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiChatOutput {
    pub content: String,
    pub model: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AiChatError {
    InvalidInput,
    InvalidProvider,
    ProviderUnavailable,
    ProviderRejected,
    UpstreamFailed,
    InvalidResponse,
}

pub fn validate_input(input: &AiChatInput) -> Result<(), AiChatError> {
    let task_len = input.task.trim().chars().count();
    let public_len = input.public_context.chars().count();
    let personal_len = input
        .personal_context
        .as_deref()
        .unwrap_or_default()
        .chars()
        .count();
    if !(1..=2_000).contains(&task_len)
        || public_len > 24_000
        || personal_len > 8_000
        || input
            .task
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    {
        return Err(AiChatError::InvalidInput);
    }
    Ok(())
}

pub async fn chat(config: &AiChatConfig, input: &AiChatInput) -> Result<AiChatOutput, AiChatError> {
    validate_input(input)?;
    let endpoint = chat_endpoint(&config.base_url)?;
    if config.api_key.trim().is_empty()
        || config.model.trim().is_empty()
        || config.model.chars().count() > 200
    {
        return Err(AiChatError::ProviderUnavailable);
    }
    timeout(
        Duration::from_secs(AI_WAIT_SECONDS),
        send_chat(config, input, endpoint),
    )
    .await
    .map_err(|_| AiChatError::UpstreamFailed)?
}

fn chat_endpoint(base_url: &str) -> Result<Url, AiChatError> {
    let mut url = Url::parse(base_url).map_err(|_| AiChatError::InvalidProvider)?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port_or_known_default() != Some(443)
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(AiChatError::InvalidProvider);
    }
    url.set_path(&format!(
        "{}/chat/completions",
        url.path().trim_end_matches('/')
    ));
    Ok(url)
}

async fn send_chat(
    config: &AiChatConfig,
    input: &AiChatInput,
    endpoint: Url,
) -> Result<AiChatOutput, AiChatError> {
    let host = endpoint.host_str().ok_or(AiChatError::InvalidProvider)?;
    let addresses = public_addresses(host, 443)
        .await
        .map_err(|_| AiChatError::InvalidProvider)?;
    let client = reqwest::Client::builder()
        .redirect(Policy::none())
        .no_proxy()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(AI_WAIT_SECONDS))
        .resolve_to_addrs(host, &addresses)
        .build()
        .map_err(|_| AiChatError::UpstreamFailed)?;
    let user_content = format!(
        "本次任务：\n{}\n\n任务所需公开依据：\n{}\n\n用户明确选择的个人内容：\n{}",
        input.task.trim(),
        if input.public_context.is_empty() {
            "未选择"
        } else {
            &input.public_context
        },
        input.personal_context.as_deref().unwrap_or("未选择"),
    );
    let response = client
        .post(endpoint)
        .bearer_auth(&config.api_key)
        .json(&serde_json::json!({
            "model": config.model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是 Campus Lumen 的机会探索助手。只根据本次提供的任务和材料回答，区分来源事实、解释与未知，不推断未提供的个人背景，不生成适配评分或申请承诺。用简洁中文回答。"
                },
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.3,
            "max_tokens": 1600,
            "stream": false
        }))
        .send()
        .await
        .map_err(|_| AiChatError::UpstreamFailed)?;
    if let Some(failure) = status_error(response.status()) {
        return Err(failure);
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err(AiChatError::InvalidResponse);
    }
    let mut bytes = Vec::new();
    let mut response = response;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| AiChatError::UpstreamFailed)?
    {
        if bytes.len() + chunk.len() > MAX_RESPONSE_BYTES {
            return Err(AiChatError::InvalidResponse);
        }
        bytes.extend_from_slice(&chunk);
    }
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| AiChatError::InvalidResponse)?;
    let content = value["choices"][0]["message"]["content"]
        .as_str()
        .map(str::trim)
        .filter(|content| !content.is_empty())
        .ok_or(AiChatError::InvalidResponse)?;
    Ok(AiChatOutput {
        content: content.to_owned(),
        model: value["model"].as_str().unwrap_or(&config.model).to_owned(),
    })
}

/// A 4xx answer means the service received and refused the request (key, quota,
/// model name or parameters); only 5xx and transport failures stay uncertain.
fn status_error(status: reqwest::StatusCode) -> Option<AiChatError> {
    if status.is_success() {
        None
    } else if status.is_client_error() {
        Some(AiChatError::ProviderRejected)
    } else {
        Some(AiChatError::UpstreamFailed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_errors_are_rejections_and_server_errors_stay_uncertain() {
        use reqwest::StatusCode;
        assert_eq!(status_error(StatusCode::OK), None);
        for status in [
            StatusCode::BAD_REQUEST,
            StatusCode::UNAUTHORIZED,
            StatusCode::NOT_FOUND,
            StatusCode::TOO_MANY_REQUESTS,
        ] {
            assert_eq!(status_error(status), Some(AiChatError::ProviderRejected));
        }
        for status in [StatusCode::BAD_GATEWAY, StatusCode::GATEWAY_TIMEOUT] {
            assert_eq!(status_error(status), Some(AiChatError::UpstreamFailed));
        }
    }

    #[test]
    fn endpoint_accepts_openai_base_url() {
        assert_eq!(
            chat_endpoint("https://api.llm.ustc.edu.cn/v1")
                .unwrap()
                .as_str(),
            "https://api.llm.ustc.edu.cn/v1/chat/completions"
        );
    }

    #[test]
    fn endpoint_rejects_credentials_insecure_urls_and_query() {
        for url in [
            "http://api.example.com/v1",
            "https://user:pass@api.example.com/v1",
            "https://api.example.com:8443/v1",
            "https://api.example.com/v1?token=secret",
        ] {
            assert_eq!(chat_endpoint(url), Err(AiChatError::InvalidProvider));
        }
    }

    #[test]
    fn input_requires_task_and_bounds_each_selected_part() {
        let valid = AiChatInput {
            task: "比较两项公开资料".into(),
            public_context: "公开依据".into(),
            personal_context: Some("只发送这一条".into()),
        };
        assert_eq!(validate_input(&valid), Ok(()));
        assert_eq!(
            validate_input(&AiChatInput {
                task: " ".into(),
                ..valid.clone()
            }),
            Err(AiChatError::InvalidInput)
        );
        assert_eq!(
            validate_input(&AiChatInput {
                personal_context: Some("私".repeat(8_001)),
                ..valid
            }),
            Err(AiChatError::InvalidInput)
        );
    }
}
