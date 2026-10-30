use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use campus_agora_application::ai::{chat, AiChatConfig, AiChatError, AiChatInput, AiChatOutput};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{api_error_response, request_id_from_headers, ApiState};

const SCHOOL_BASE_URL: &str = "https://api.llm.ustc.edu.cn/v1";
const SCHOOL_DEFAULT_MODEL: &str = "deepseek-v4-pro";

#[derive(Clone)]
pub struct SchoolAiConfig {
    pub api_key: String,
    pub model: String,
}

impl SchoolAiConfig {
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var("USTC_LLM_API_KEY").ok()?;
        if api_key.trim().is_empty() {
            return None;
        }
        let model = std::env::var("USTC_LLM_MODEL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| SCHOOL_DEFAULT_MODEL.to_owned());
        Some(Self { api_key, model })
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProvidersResponse {
    pub school: AiProviderStatus,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderStatus {
    pub id: &'static str,
    pub name: &'static str,
    pub configured: bool,
    pub model: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub provider: String,
    pub task: String,
    #[serde(default)]
    pub public_context: String,
    pub personal_context: Option<String>,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub provider: String,
    pub content: String,
    pub model: String,
}

pub async fn providers(State(state): State<ApiState>) -> Json<AiProvidersResponse> {
    Json(AiProvidersResponse {
        school: AiProviderStatus {
            id: "school",
            name: "学校词元计划",
            configured: state.school_ai.is_some(),
            model: state
                .school_ai
                .as_ref()
                .map(|config| config.model.clone())
                .unwrap_or_else(|| SCHOOL_DEFAULT_MODEL.to_owned()),
        },
    })
}

pub async fn completions(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(request): Json<AiChatRequest>,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let Ok(_permit) = state.ai_permits.clone().try_acquire_owned() else {
        return error(
            StatusCode::TOO_MANY_REQUESTS,
            "ai_busy",
            "当前AI请求较多，请稍后主动重试；不要重复提交个人内容。",
            request_id,
        );
    };
    let input = AiChatInput {
        task: request.task,
        public_context: request.public_context,
        personal_context: request.personal_context,
    };
    let (provider, config) = match request.provider.as_str() {
        "school" => {
            let Some(school) = state.school_ai else {
                return error(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "school_ai_not_configured",
                    "学校词元计划尚未配置服务端密钥；可改用自己的AI，或稍后重试。",
                    request_id,
                );
            };
            (
                "school",
                AiChatConfig {
                    base_url: SCHOOL_BASE_URL.to_owned(),
                    model: school.model,
                    api_key: school.api_key,
                },
            )
        }
        "custom" => {
            let (Some(base_url), Some(model), Some(api_key)) =
                (request.base_url, request.model, request.api_key)
            else {
                return invalid("请填写自己的API基础地址、模型和API Key。", request_id);
            };
            if base_url.trim().is_empty() || model.trim().is_empty() || api_key.trim().is_empty() {
                return invalid("请填写自己的API基础地址、模型和API Key。", request_id);
            }
            (
                "custom",
                AiChatConfig {
                    base_url,
                    model,
                    api_key,
                },
            )
        }
        _ => return invalid("AI提供方只能是school或custom。", request_id),
    };
    match chat(&config, &input).await {
        Ok(AiChatOutput { content, model }) => (
            StatusCode::OK,
            Json(AiChatResponse {
                provider: provider.to_owned(),
                content,
                model,
            }),
        )
            .into_response(),
        Err(failure) => {
            let (status, code, message) = match failure {
                AiChatError::InvalidInput => (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "validation_failed",
                    "请检查本次任务和所选内容长度；任务为1至2000字，公开依据最多24000字，个人内容最多8000字。",
                ),
                AiChatError::InvalidProvider => (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "invalid_ai_provider",
                    "自定义API地址必须是可公开访问的HTTPS地址，使用443端口，且不能包含凭据、查询或片段。",
                ),
                AiChatError::ProviderUnavailable => (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "invalid_ai_provider",
                    "模型和API Key不能为空，模型名称最多200字。",
                ),
                AiChatError::ProviderRejected => (
                    StatusCode::BAD_GATEWAY,
                    "ai_provider_rejected",
                    "AI服务拒绝了请求，请检查密钥、模型名称、模型权限或额度；已发送的内容可能仍由服务方处理。",
                ),
                AiChatError::UpstreamFailed => (
                    StatusCode::BAD_GATEWAY,
                    "ai_upstream_failed",
                    "AI服务出错、未返回结果或连接超时；发送状态未确认，可能已发送。可在核对本次内容后主动重试。",
                ),
                AiChatError::InvalidResponse => (
                    StatusCode::BAD_GATEWAY,
                    "ai_invalid_response",
                    "AI服务返回了无法识别或过大的响应；发送状态未确认，可能已发送。",
                ),
            };
            error(status, code, message, request_id)
        }
    }
}

fn invalid(message: &'static str, request_id: String) -> Response {
    error(
        StatusCode::UNPROCESSABLE_ENTITY,
        "validation_failed",
        message,
        request_id,
    )
}

fn error(
    status: StatusCode,
    code: &'static str,
    message: &'static str,
    request_id: String,
) -> Response {
    api_error_response(status, code, message, request_id, None).into_response()
}

pub fn extend_contract(document: &mut Value) {
    document["paths"]["/api/v1/ai/providers"] = json!({
        "get": {
            "operationId": "getAiProviders",
            "summary": "AI provider availability without credentials",
            "security": [],
            "responses": {
                "200": {
                    "description": "School provider configuration status",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AiProvidersResponse"}}}
                }
            }
        }
    });
    document["paths"]["/api/v1/ai/completions"] = json!({
        "post": {
            "operationId": "createAiCompletion",
            "summary": "One explicitly selected AI request with no conversation history or persistence",
            "security": [],
            "requestBody": {
                "required": true,
                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AiChatRequest"}}}
            },
            "responses": {
                "200": {
                    "description": "AI response",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AiChatResponse"}}}
                },
                "422": {"description": "Invalid input or provider", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ApiErrorResponse"}}}},
                "429": {"description": "AI request concurrency limit", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ApiErrorResponse"}}}},
                "502": {"description": "Upstream failure; delivery may be uncertain", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ApiErrorResponse"}}}},
                "503": {"description": "School provider not configured", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ApiErrorResponse"}}}}
            }
        }
    });
    let schemas = document["components"]["schemas"]
        .as_object_mut()
        .expect("schemas");
    schemas.insert(
        "AiProviderStatus".into(),
        json!({
            "type": "object",
            "required": ["id", "name", "configured", "model"],
            "properties": {
                "id": {"type": "string", "const": "school"},
                "name": {"type": "string"},
                "configured": {"type": "boolean"},
                "model": {"type": "string"}
            }
        }),
    );
    schemas.insert(
        "AiProvidersResponse".into(),
        json!({
            "type": "object", "required": ["school"],
            "properties": {"school": {"$ref": "#/components/schemas/AiProviderStatus"}}
        }),
    );
    schemas.insert("AiChatRequest".into(), json!({
        "type": "object",
        "required": ["provider", "task"],
        "properties": {
            "provider": {"type": "string", "enum": ["school", "custom"]},
            "task": {"type": "string", "minLength": 1, "maxLength": 2000},
            "publicContext": {"type": "string", "maxLength": 24000, "default": ""},
            "personalContext": {"type": "string", "maxLength": 8000, "description": "Only the personal item explicitly selected for this one request; never an entire topic."},
            "baseUrl": {"type": "string", "format": "uri", "description": "Required only for custom; HTTPS OpenAI-compatible base URL."},
            "model": {"type": "string", "maxLength": 200, "description": "Required only for custom."},
            "apiKey": {"type": "string", "writeOnly": true, "description": "Required only for custom; used for this request, never persisted or logged."}
        }
    }));
    schemas.insert(
        "AiChatResponse".into(),
        json!({
            "type": "object", "required": ["provider", "content", "model"],
            "properties": {
                "provider": {"type": "string", "enum": ["school", "custom"]},
                "content": {"type": "string"},
                "model": {"type": "string"}
            }
        }),
    );
}
