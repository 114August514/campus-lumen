//! One-shot OpenAI-compatible chat transport, ported from jasonxu-cell 14b0ba6.
//! Credentials are used in memory only.

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
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiChatOutput {
    pub content: String,
    pub model: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AiChatError {
    InvalidProvider,
    ProviderUnavailable,
    ProviderRejected,
    UpstreamFailed,
    InvalidResponse,
}

pub async fn complete(
    config: &AiChatConfig,
    messages: &[ChatMessage],
    max_tokens: u32,
) -> Result<AiChatOutput, AiChatError> {
    let endpoint = chat_endpoint(&config.base_url)?;
    if config.api_key.trim().is_empty()
        || config.model.trim().is_empty()
        || config.model.chars().count() > 200
        || messages.is_empty()
        || max_tokens == 0
    {
        return Err(AiChatError::ProviderUnavailable);
    }
    timeout(
        Duration::from_secs(AI_WAIT_SECONDS),
        send_chat(config, messages, max_tokens, endpoint),
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
    messages: &[ChatMessage],
    max_tokens: u32,
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
    let response = client
        .post(endpoint)
        .bearer_auth(&config.api_key)
        .json(&serde_json::json!({
            "model": config.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": max_tokens,
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
}
