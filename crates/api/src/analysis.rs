use std::time::Duration;

use axum::extract::{rejection::JsonRejection, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use campus_agora_application::ai::{self, AiChatConfig, AiChatError};
use campus_agora_application::analysis::{
    self, AnalysisProviderChoice, AnalysisRequest, AnalysisResponse, SimulationOutcome,
};
use serde::Serialize;
use serde_json::{json, Value};

use crate::{api_error_response, request_id_from_headers, ApiState};

pub(crate) async fn analyze(
    State(state): State<ApiState>,
    headers: HeaderMap,
    input: Result<Json<AnalysisRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let input = match input {
        Ok(Json(input)) => input,
        Err(rejection) => {
            let body_text = rejection.body_text();
            let field = body_text
                .split("unknown field `")
                .nth(1)
                .and_then(|rest| rest.split('`').next())
                .unwrap_or("body");
            return api_error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "validation_failed",
                "整理请求的JSON结构无效。",
                request_id,
                Some(json!({ "fields": [{ "field": field, "message": "must match the analysis request schema" }] })),
            )
            .into_response();
        }
    };
    let request = match analysis::validate(input) {
        Ok(request) => request,
        Err(error) => {
            let fields = error
                .fields
                .into_iter()
                .map(|issue| json!({ "field": issue.field, "message": issue.message }))
                .collect::<Vec<_>>();
            return api_error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "validation_failed",
                "整理请求包含无效字段。",
                request_id,
                Some(json!({ "fields": fields })),
            )
            .into_response();
        }
    };
    let provider = request.provider.unwrap_or_default();
    tracing::info!(
        request_id = %request_id,
        provider = match provider {
            AnalysisProviderChoice::Simulated => "simulated-organizer",
            AnalysisProviderChoice::School => "ustc-llm",
        },
        subject_count = request.subjects.len(),
        evidence_count = request.evidence.len(),
        private_fragment_count = request.selected_private_fragments.len(),
        "analysis dispatched"
    );

    if provider == AnalysisProviderChoice::School {
        return analyze_with_school(state, request, request_id).await;
    }
    let (outcome, delay_ms) = analysis::simulation_timing(&request);
    if outcome == SimulationOutcome::Hang {
        tokio::time::sleep(Duration::from_secs(20)).await;
    } else {
        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
    }
    if outcome == SimulationOutcome::Error {
        return api_error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "analysis_simulated_failure",
            "模拟整理服务按请求返回失败。",
            request_id,
            None,
        )
        .into_response();
    }
    Json::<AnalysisResponse>(analysis::organize(request)).into_response()
}

async fn analyze_with_school(
    state: ApiState,
    request: AnalysisRequest,
    request_id: String,
) -> Response {
    let Some(config) = state.school_ai else {
        return api_error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "school_ai_not_configured",
            "学校词元计划尚未在服务端配置，本次没有转发给平台。",
            request_id,
            None,
        )
        .into_response();
    };
    let Ok(_permit) = state.ai_permits.try_acquire_owned() else {
        return api_error_response(
            StatusCode::TOO_MANY_REQUESTS,
            "ai_busy",
            "AI 请求较多，本次没有转发给平台；请稍后主动重试。",
            request_id,
            None,
        )
        .into_response();
    };
    let chat_config = AiChatConfig {
        base_url: "https://api.llm.ustc.edu.cn/v1".into(),
        model: config.model,
        api_key: config.api_key,
    };
    let messages = analysis::model_messages(&request);
    // Shorter answers keep the campus model well inside the 60 s transport limit.
    match ai::complete(&chat_config, &messages, 1_000).await {
        Ok(output) => Json(analysis::organize_from_model(
            request,
            &output.content,
            &output.model,
        ))
        .into_response(),
        Err(AiChatError::ProviderRejected) => api_error_response(
            StatusCode::BAD_GATEWAY,
            "ai_provider_rejected",
            "词元计划平台拒绝了请求（如 Key、额度或模型权限），内容已发给平台。",
            request_id,
            None,
        )
        .into_response(),
        Err(AiChatError::InvalidResponse) => api_error_response(
            StatusCode::BAD_GATEWAY,
            "ai_invalid_response",
            "词元计划平台的回答无法解析，内容已发给平台。",
            request_id,
            None,
        )
        .into_response(),
        Err(
            AiChatError::UpstreamFailed
            | AiChatError::InvalidProvider
            | AiChatError::ProviderUnavailable,
        ) => api_error_response(
            StatusCode::BAD_GATEWAY,
            "ai_provider_failed",
            "词元计划平台未正常返回，内容可能已发给平台。",
            request_id,
            None,
        )
        .into_response(),
    }
}

#[derive(Serialize)]
pub(crate) struct AnalysisProvidersResponse {
    school: SchoolProviderStatus,
}

#[derive(Serialize)]
pub(crate) struct SchoolProviderStatus {
    available: bool,
    label: &'static str,
    model: String,
}

pub(crate) async fn providers(State(state): State<ApiState>) -> Json<AnalysisProvidersResponse> {
    Json(AnalysisProvidersResponse {
        school: SchoolProviderStatus {
            available: state.school_ai.is_some(),
            label: "中国科大大模型公共服务平台（词元计划）",
            model: state
                .school_ai
                .as_ref()
                .map(|config| config.model.clone())
                .unwrap_or_else(|| "deepseek-v4-flash-ascend".into()),
        },
    })
}

pub(crate) fn extend_contract(document: &mut Value) {
    document["paths"]["/api/v1/analyses"] = json!({
        "post": {
            "operationId": "requestAnalysis",
            "summary": "Organize explicitly selected evidence and private fragments",
            "description": "The simulated provider is deterministic and uses no external network. The school provider forwards only the listed public evidence and explicitly selected private fragments to the campus model platform. Submitted text is never logged or retained by this backend.",
            "security": [],
            "requestBody": {
                "required": true,
                "content": { "application/json": { "schema": { "$ref": "#/components/schemas/AnalysisRequest" } } }
            },
            "responses": {
                "200": { "description": "Organized analysis", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/AnalysisResponse" } } } },
                "422": { "description": "Invalid request with field-specific details", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } },
                "429": { "description": "School AI concurrency limit reached before forwarding", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } },
                "502": { "description": "School AI rejected, failed, or returned an invalid response", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } },
                "503": { "description": "Provider unavailable or requested simulated failure", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } },
                "413": { "description": "Request body exceeds configured limit", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } }
            }
        }
    });
    document["paths"]["/api/v1/analyses/providers"] = json!({
        "get": {
            "operationId": "getAnalysisProviders",
            "summary": "Report whether the school AI provider is configured",
            "security": [],
            "responses": {
                "200": { "description": "Analysis provider availability without credentials", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/AnalysisProvidersResponse" } } } }
            }
        }
    });
    let schemas = &mut document["components"]["schemas"];
    schemas["AnalysisRequest"] = json!({
        "type": "object", "additionalProperties": false,
        "required": ["operation", "question", "subjects", "evidence", "selectedPrivateFragments"],
        "properties": {
            "operation": { "$ref": "#/components/schemas/AnalysisOperation" },
            "question": { "type": "string", "minLength": 1, "maxLength": 300 },
            "subjects": { "type": "array", "minItems": 1, "maxItems": 8, "items": { "$ref": "#/components/schemas/AnalysisSubject" } },
            "evidence": { "type": "array", "maxItems": 60, "items": { "$ref": "#/components/schemas/AnalysisEvidence" } },
            "selectedPrivateFragments": { "type": "array", "maxItems": 10, "items": { "$ref": "#/components/schemas/SelectedPrivateFragment" } },
            "provider": { "$ref": "#/components/schemas/AnalysisProviderChoice", "default": "simulated" },
            "simulation": { "$ref": "#/components/schemas/AnalysisSimulation", "description": "Applies only to the simulated provider and is ignored for school." }
        }
    });
    schemas["AnalysisProviderChoice"] =
        json!({ "type": "string", "enum": ["simulated", "school"] });
    schemas["AnalysisOperation"] = json!({ "type": "string", "enum": ["compare", "shortlist"] });
    schemas["AnalysisSubjectKind"] =
        json!({ "type": "string", "enum": ["advisor", "internship", "entry"] });
    schemas["AnalysisSubject"] = json!({
        "type": "object", "additionalProperties": false, "required": ["id", "name", "kind"],
        "properties": {
            "id": { "type": "string", "minLength": 1, "maxLength": 120 },
            "name": { "type": "string", "minLength": 1, "maxLength": 120 },
            "kind": { "$ref": "#/components/schemas/AnalysisSubjectKind" }
        }
    });
    schemas["AnalysisEvidence"] = json!({
        "type": "object", "additionalProperties": false, "required": ["ref", "subjectId", "aspect", "text"],
        "properties": {
            "ref": { "type": "string", "minLength": 1, "maxLength": 40 },
            "subjectId": { "type": "string", "minLength": 1, "maxLength": 120 },
            "aspect": { "type": "string", "minLength": 1, "maxLength": 40 },
            "text": { "type": "string", "minLength": 1, "maxLength": 800 },
            "sourceTitle": { "type": "string", "maxLength": 200 },
            "sourceUrl": { "type": "string", "format": "uri", "maxLength": 500, "pattern": "^https://" },
            "collectedAt": { "type": "string", "format": "date-time" }
        }
    });
    schemas["PrivateFragmentKind"] = json!({ "type": "string", "enum": ["reason", "question"] });
    schemas["SelectedPrivateFragment"] = json!({
        "type": "object", "additionalProperties": false, "required": ["id", "kind", "text"],
        "properties": {
            "id": { "type": "string", "minLength": 1, "maxLength": 60 },
            "kind": { "$ref": "#/components/schemas/PrivateFragmentKind" },
            "subjectId": { "type": "string", "minLength": 1, "maxLength": 120 },
            "text": { "type": "string", "minLength": 1, "maxLength": 500 }
        }
    });
    schemas["AnalysisSimulationOutcome"] =
        json!({ "type": "string", "enum": ["ok", "error", "hang"] });
    schemas["AnalysisSimulation"] = json!({
        "type": "object", "additionalProperties": false, "required": ["outcome"],
        "properties": {
            "outcome": { "$ref": "#/components/schemas/AnalysisSimulationOutcome" },
            "delayMs": { "type": "integer", "minimum": 0, "maximum": 5000 }
        }
    });
    schemas["AnalysisResponse"] = json!({
        "type": "object", "additionalProperties": false,
        "required": ["analysisId", "operation", "question", "createdAt", "provider", "received", "sections", "caveats"],
        "properties": {
            "analysisId": { "type": "string" },
            "operation": { "$ref": "#/components/schemas/AnalysisOperation" },
            "question": { "type": "string" },
            "createdAt": { "type": "string", "format": "date-time" },
            "provider": { "$ref": "#/components/schemas/AnalysisProvider" },
            "received": { "$ref": "#/components/schemas/AnalysisReceived" },
            "sections": { "type": "array", "items": { "$ref": "#/components/schemas/AnalysisSection" } },
            "caveats": { "type": "array", "items": { "type": "string" } }
        }
    });
    schemas["AnalysisProvider"] = json!({
        "type": "object", "additionalProperties": false, "required": ["id", "label", "simulated", "retention"],
        "properties": {
            "id": { "type": "string", "enum": ["simulated-organizer", "ustc-llm"] },
            "label": { "type": "string" },
            "simulated": { "type": "boolean" },
            "retention": { "type": "string", "enum": ["none", "unverified"] },
            "model": { "type": "string" }
        }
    });
    schemas["AnalysisProvidersResponse"] = json!({
        "type": "object", "additionalProperties": false, "required": ["school"],
        "properties": {
            "school": { "$ref": "#/components/schemas/SchoolProviderStatus" }
        }
    });
    schemas["SchoolProviderStatus"] = json!({
        "type": "object", "additionalProperties": false, "required": ["available", "label", "model"],
        "properties": {
            "available": { "type": "boolean" },
            "label": { "type": "string" },
            "model": { "type": "string" }
        }
    });
    schemas["AnalysisReceived"] = json!({
        "type": "object", "additionalProperties": false, "required": ["subjectIds", "evidenceRefs", "privateFragmentIds"],
        "properties": {
            "subjectIds": { "type": "array", "items": { "type": "string" } },
            "evidenceRefs": { "type": "array", "items": { "type": "string" } },
            "privateFragmentIds": { "type": "array", "items": { "type": "string" } }
        }
    });
    schemas["AnalysisSectionKind"] = json!({ "type": "string", "enum": ["differences", "question_related", "your_notes", "to_confirm"] });
    schemas["AnalysisSection"] = json!({
        "type": "object", "additionalProperties": false, "required": ["kind", "title", "points"],
        "properties": {
            "kind": { "$ref": "#/components/schemas/AnalysisSectionKind" },
            "title": { "type": "string" },
            "points": { "type": "array", "items": { "$ref": "#/components/schemas/AnalysisPoint" } }
        }
    });
    schemas["AnalysisPoint"] = json!({
        "type": "object", "additionalProperties": false, "required": ["text", "evidenceRefs", "privateFragmentIds"],
        "properties": {
            "text": { "type": "string" },
            "evidenceRefs": { "type": "array", "items": { "type": "string" } },
            "privateFragmentIds": { "type": "array", "items": { "type": "string" } }
        }
    });
}
