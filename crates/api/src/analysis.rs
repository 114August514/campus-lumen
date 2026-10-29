use std::time::Duration;

use axum::extract::rejection::JsonRejection;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use campus_agora_application::analysis::{
    self, AnalysisRequest, AnalysisResponse, SimulationOutcome,
};
use serde_json::{json, Value};

use crate::{api_error_response, request_id_from_headers};

pub(crate) async fn analyze(
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

    // Privacy boundary: structured logs contain counts and identifiers only, never submitted text.
    tracing::info!(
        request_id = %request_id,
        subject_count = request.subjects.len(),
        evidence_count = request.evidence.len(),
        private_fragment_count = request.selected_private_fragments.len(),
        "simulated analysis dispatched"
    );

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

pub(crate) fn extend_contract(document: &mut Value) {
    document["paths"]["/api/v1/analyses"] = json!({
        "post": {
            "operationId": "requestAnalysis",
            "summary": "Organize explicitly selected evidence and private fragments with a deterministic simulated service",
            "description": "No model or external network is used. Private fragments are accepted only when explicitly selected, are never logged as text, and are not retained.",
            "security": [],
            "requestBody": {
                "required": true,
                "content": { "application/json": { "schema": { "$ref": "#/components/schemas/AnalysisRequest" } } }
            },
            "responses": {
                "200": { "description": "Deterministic simulated organization", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/AnalysisResponse" } } } },
                "422": { "description": "Invalid request with field-specific details", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } },
                "503": { "description": "Requested simulated failure", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } },
                "413": { "description": "Request body exceeds configured limit", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } }
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
            "simulation": { "$ref": "#/components/schemas/AnalysisSimulation" }
        }
    });
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
            "id": { "type": "string", "const": "simulated-organizer" },
            "label": { "type": "string", "const": "模拟整理服务" },
            "simulated": { "type": "boolean", "const": true },
            "retention": { "type": "string", "const": "none" }
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
