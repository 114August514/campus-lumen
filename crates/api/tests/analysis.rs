use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use campus_agora_api::{build_router_with_state, ApiState, ReadinessStatus};
use serde_json::{json, Value};
use tower::ServiceExt;

fn valid_request() -> Value {
    json!({
        "operation": "compare",
        "question": "哪个方向更适合机器学习？",
        "subjects": [
            { "id": "advisor-a", "name": "候选甲", "kind": "advisor" },
            { "id": "advisor-b", "name": "候选乙", "kind": "advisor" }
        ],
        "evidence": [
            { "ref": "source-a", "subjectId": "advisor-a", "aspect": "研究方向", "text": "机器学习与系统研究。" },
            { "ref": "source-b", "subjectId": "advisor-b", "aspect": "unknowns", "text": "当前参与方式仍需确认。" }
        ],
        "selectedPrivateFragments": [
            { "id": "note-a", "kind": "reason", "subjectId": "advisor-a", "text": "我想学习机器学习" }
        ],
        "simulation": { "outcome": "ok", "delayMs": 0 }
    })
}

async fn post(body: Value) -> (StatusCode, Value) {
    let response = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready))
        .oneshot(
            Request::post("/api/v1/analyses")
                .header("content-type", "application/json")
                .header("x-request-id", "analysis-test")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let body =
        serde_json::from_slice(&to_bytes(response.into_body(), 128 * 1024).await.unwrap()).unwrap();
    (status, body)
}

#[tokio::test]
async fn valid_request_echoes_exact_received_ids() {
    let (status, body) = post(valid_request()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        body["received"],
        json!({
            "subjectIds": ["advisor-a", "advisor-b"],
            "evidenceRefs": ["source-a", "source-b"],
            "privateFragmentIds": ["note-a"]
        })
    );
    assert_eq!(body["provider"]["id"], "simulated-organizer");
    assert_eq!(body["provider"]["simulated"], true);
}

#[tokio::test]
async fn request_without_private_fragments_omits_your_notes_section() {
    let mut request = valid_request();
    request["selectedPrivateFragments"] = json!([]);
    let (status, body) = post(request).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["sections"]
        .as_array()
        .unwrap()
        .iter()
        .all(|section| section["kind"] != "your_notes"));
}

#[tokio::test]
async fn unknown_fields_are_rejected() {
    let mut request = valid_request();
    request["subjects"][0]["privateNote"] = json!("must not be accepted");
    let (status, body) = post(request).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "validation_failed");
    assert_eq!(body["details"]["fields"][0]["field"], "privateNote");
}
#[tokio::test]
async fn invalid_references_fragment_limit_and_compare_cardinality_return_field_details() {
    let mut bad_reference = valid_request();
    bad_reference["evidence"][0]["subjectId"] = json!("missing");
    let (status, body) = post(bad_reference).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(body["details"]["fields"]
        .as_array()
        .unwrap()
        .iter()
        .any(|field| field["field"] == "evidence[0].subjectId"));

    let mut too_many = valid_request();
    too_many["selectedPrivateFragments"] = Value::Array(
        (0..11)
            .map(|index| json!({ "id": format!("n{index}"), "kind": "question", "text": "待确认" }))
            .collect(),
    );
    let (status, body) = post(too_many).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(body["details"]["fields"]
        .as_array()
        .unwrap()
        .iter()
        .any(|field| field["field"] == "selectedPrivateFragments"));

    let mut one_subject = valid_request();
    one_subject["subjects"] = json!([{ "id": "advisor-a", "name": "候选甲", "kind": "advisor" }]);
    one_subject["evidence"] = json!([]);
    one_subject["selectedPrivateFragments"] = json!([]);
    let (status, body) = post(one_subject).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(body["details"]["fields"]
        .as_array()
        .unwrap()
        .iter()
        .any(|field| field["field"] == "subjects"));
}

#[tokio::test]
async fn requested_simulation_failure_returns_503() {
    let mut request = valid_request();
    request["simulation"] = json!({ "outcome": "error", "delayMs": 0 });
    let (status, body) = post(request).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["code"], "analysis_simulated_failure");
    assert_eq!(body["requestId"], "analysis-test");
}

#[tokio::test]
async fn providers_report_school_unavailable_without_server_key() {
    let response = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready))
        .oneshot(
            Request::get("/api/v1/analyses/providers")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), 16 * 1024).await.unwrap()).unwrap();
    assert_eq!(body["school"]["available"], false);
    assert_eq!(body["school"]["model"], "deepseek-v4-flash-ascend");
    assert!(body["school"].get("apiKey").is_none());
}

#[tokio::test]
async fn school_request_without_config_fails_before_forwarding() {
    let mut request = valid_request();
    request["provider"] = json!("school");
    let (status, body) = post(request).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["code"], "school_ai_not_configured");
    assert_eq!(
        body["message"],
        "学校词元计划尚未在服务端配置，本次没有转发给平台。"
    );
}

#[test]
fn analysis_contract_is_public_strict_and_typed() {
    let contract = campus_agora_api::openapi_document();
    let operation = &contract["paths"]["/api/v1/analyses"]["post"];
    assert_eq!(operation["operationId"], "requestAnalysis");
    assert_eq!(operation["security"], json!([]));
    assert!(operation["responses"]["422"].is_object());
    assert!(operation["responses"]["503"].is_object());
    for schema in [
        "AnalysisRequest",
        "AnalysisSubject",
        "AnalysisEvidence",
        "SelectedPrivateFragment",
        "AnalysisSimulation",
        "AnalysisProvidersResponse",
        "SchoolProviderStatus",
    ] {
        assert_eq!(
            contract["components"]["schemas"][schema]["additionalProperties"], false,
            "{schema} must reject unknown fields"
        );
    }
}
