use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use campus_agora_api::{build_router_with_state, ApiState, ReadinessStatus};
use serde_json::{json, Value};
use tower::ServiceExt;

#[tokio::test]
async fn provider_status_exposes_configuration_not_credentials() {
    let response = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready))
        .oneshot(
            Request::builder()
                .uri("/api/v1/ai/providers")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = json_body(response).await;
    assert_eq!(body["school"]["configured"], false);
    assert_eq!(body["school"]["model"], "deepseek-v4-pro");
    assert!(body["school"].get("apiKey").is_none());
}

#[tokio::test]
async fn unconfigured_school_provider_fails_without_calling_a_model() {
    let response = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/ai/completions")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({"provider": "school", "task": "比较公开资料"}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body = json_body(response).await;
    assert_eq!(body["code"], "school_ai_not_configured");
    assert!(body["requestId"].is_string());
}

#[tokio::test]
async fn custom_provider_rejects_insecure_endpoint_before_sending_content() {
    let response = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready))
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/ai/completions")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "provider": "custom",
                        "task": "只处理本次选择",
                        "personalContext": "合成私人内容",
                        "baseUrl": "http://127.0.0.1/v1",
                        "model": "test",
                        "apiKey": "not-a-real-key"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body = json_body(response).await;
    assert_eq!(body["code"], "invalid_ai_provider");
    assert!(!body.to_string().contains("合成私人内容"));
    assert!(!body.to_string().contains("not-a-real-key"));
}

async fn json_body(response: axum::response::Response) -> Value {
    let bytes = to_bytes(response.into_body(), 64_000).await.unwrap();
    serde_json::from_slice(&bytes).unwrap()
}
