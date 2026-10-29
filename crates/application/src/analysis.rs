//! Deterministic, in-process simulated organizer for explicit user-selected material.

use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};

use chrono::{DateTime, SecondsFormat, Utc};
use reqwest::Url;
use serde::{Deserialize, Serialize};

static ANALYSIS_COUNTER: AtomicU64 = AtomicU64::new(1);
const STOPWORDS: &[&str] = &[
    "可以", "以及", "进行", "相关", "需要", "是否", "我们", "一个",
];

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnalysisRequest {
    pub operation: AnalysisOperation,
    pub question: String,
    pub subjects: Vec<AnalysisSubject>,
    pub evidence: Vec<AnalysisEvidence>,
    pub selected_private_fragments: Vec<PrivateFragment>,
    #[serde(default)]
    pub simulation: Option<SimulationOptions>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisOperation {
    Compare,
    Shortlist,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnalysisSubject {
    pub id: String,
    pub name: String,
    pub kind: SubjectKind,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SubjectKind {
    Advisor,
    Internship,
    Entry,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnalysisEvidence {
    #[serde(rename = "ref")]
    pub reference: String,
    pub subject_id: String,
    pub aspect: String,
    pub text: String,
    #[serde(default)]
    pub source_title: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub collected_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PrivateFragment {
    pub id: String,
    pub kind: PrivateFragmentKind,
    #[serde(default)]
    pub subject_id: Option<String>,
    pub text: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PrivateFragmentKind {
    Reason,
    Question,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SimulationOptions {
    pub outcome: SimulationOutcome,
    #[serde(default)]
    pub delay_ms: Option<u64>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SimulationOutcome {
    Ok,
    Error,
    Hang,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResponse {
    pub analysis_id: String,
    pub operation: AnalysisOperation,
    pub question: String,
    pub created_at: String,
    pub provider: AnalysisProvider,
    pub received: ReceivedMaterial,
    pub sections: Vec<AnalysisSection>,
    pub caveats: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisProvider {
    pub id: &'static str,
    pub label: &'static str,
    pub simulated: bool,
    pub retention: &'static str,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceivedMaterial {
    pub subject_ids: Vec<String>,
    pub evidence_refs: Vec<String>,
    pub private_fragment_ids: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisSection {
    pub kind: SectionKind,
    pub title: &'static str,
    pub points: Vec<AnalysisPoint>,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SectionKind {
    Differences,
    QuestionRelated,
    YourNotes,
    ToConfirm,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisPoint {
    pub text: String,
    pub evidence_refs: Vec<String>,
    pub private_fragment_ids: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ValidationIssue {
    pub field: String,
    pub message: &'static str,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ValidationError {
    pub fields: Vec<ValidationIssue>,
}

pub fn validate(mut request: AnalysisRequest) -> Result<AnalysisRequest, ValidationError> {
    let mut fields = Vec::new();
    trim(&mut request.question);
    bounded_text(&request.question, 1, 300, "question", true, &mut fields);

    if request.subjects.is_empty() || request.subjects.len() > 8 {
        issue(
            &mut fields,
            "subjects",
            "must contain between 1 and 8 items",
        );
    }
    if matches!(request.operation, AnalysisOperation::Compare) && request.subjects.len() < 2 {
        issue(
            &mut fields,
            "subjects",
            "compare requires at least 2 subjects",
        );
    }
    let mut subject_ids = HashSet::new();
    for (index, subject) in request.subjects.iter_mut().enumerate() {
        trim(&mut subject.id);
        trim(&mut subject.name);
        bounded_text(
            &subject.id,
            1,
            120,
            &format!("subjects[{index}].id"),
            false,
            &mut fields,
        );
        bounded_text(
            &subject.name,
            1,
            120,
            &format!("subjects[{index}].name"),
            false,
            &mut fields,
        );
        if !subject_ids.insert(subject.id.clone()) {
            issue(
                &mut fields,
                &format!("subjects[{index}].id"),
                "must be unique",
            );
        }
    }

    if request.evidence.len() > 60 {
        issue(&mut fields, "evidence", "must contain at most 60 items");
    }
    let mut evidence_refs = HashSet::new();
    for (index, evidence) in request.evidence.iter_mut().enumerate() {
        trim(&mut evidence.reference);
        trim(&mut evidence.subject_id);
        trim(&mut evidence.aspect);
        trim(&mut evidence.text);
        bounded_text(
            &evidence.reference,
            1,
            40,
            &format!("evidence[{index}].ref"),
            false,
            &mut fields,
        );
        bounded_text(
            &evidence.subject_id,
            1,
            120,
            &format!("evidence[{index}].subjectId"),
            false,
            &mut fields,
        );
        bounded_text(
            &evidence.aspect,
            1,
            40,
            &format!("evidence[{index}].aspect"),
            false,
            &mut fields,
        );
        bounded_text(
            &evidence.text,
            1,
            800,
            &format!("evidence[{index}].text"),
            false,
            &mut fields,
        );
        if !evidence_refs.insert(evidence.reference.clone()) {
            issue(
                &mut fields,
                &format!("evidence[{index}].ref"),
                "must be unique",
            );
        }
        if !subject_ids.contains(&evidence.subject_id) {
            issue(
                &mut fields,
                &format!("evidence[{index}].subjectId"),
                "must reference a subject id",
            );
        }
        if let Some(title) = &mut evidence.source_title {
            trim(title);
            bounded_text(
                title,
                0,
                200,
                &format!("evidence[{index}].sourceTitle"),
                false,
                &mut fields,
            );
        }
        if let Some(url) = &mut evidence.source_url {
            trim(url);
            if url.chars().count() > 500
                || Url::parse(url).map_or(true, |parsed| parsed.scheme() != "https")
            {
                issue(
                    &mut fields,
                    &format!("evidence[{index}].sourceUrl"),
                    "must be an HTTPS URL of at most 500 characters",
                );
            }
        }
        if let Some(collected_at) = &mut evidence.collected_at {
            trim(collected_at);
            if DateTime::parse_from_rfc3339(collected_at).is_err() {
                issue(
                    &mut fields,
                    &format!("evidence[{index}].collectedAt"),
                    "must be an RFC3339 timestamp",
                );
            }
        }
    }

    if request.selected_private_fragments.len() > 10 {
        issue(
            &mut fields,
            "selectedPrivateFragments",
            "must contain at most 10 items",
        );
    }
    let mut fragment_ids = HashSet::new();
    for (index, fragment) in request.selected_private_fragments.iter_mut().enumerate() {
        trim(&mut fragment.id);
        trim(&mut fragment.text);
        bounded_text(
            &fragment.id,
            1,
            60,
            &format!("selectedPrivateFragments[{index}].id"),
            false,
            &mut fields,
        );
        bounded_text(
            &fragment.text,
            1,
            500,
            &format!("selectedPrivateFragments[{index}].text"),
            false,
            &mut fields,
        );
        if !fragment_ids.insert(fragment.id.clone()) {
            issue(
                &mut fields,
                &format!("selectedPrivateFragments[{index}].id"),
                "must be unique",
            );
        }
        if let Some(subject_id) = &mut fragment.subject_id {
            trim(subject_id);
            if !subject_ids.contains(subject_id) {
                issue(
                    &mut fields,
                    &format!("selectedPrivateFragments[{index}].subjectId"),
                    "must reference a subject id",
                );
            }
        }
    }

    if request
        .simulation
        .as_ref()
        .and_then(|simulation| simulation.delay_ms)
        .is_some_and(|delay| delay > 5_000)
    {
        issue(
            &mut fields,
            "simulation.delayMs",
            "must be between 0 and 5000",
        );
    }

    if fields.is_empty() {
        Ok(request)
    } else {
        Err(ValidationError { fields })
    }
}

pub fn organize(request: AnalysisRequest) -> AnalysisResponse {
    let mut sections = Vec::new();
    sections.push(AnalysisSection {
        kind: SectionKind::Differences,
        title: "资料差异",
        points: difference_points(&request),
    });
    sections.push(AnalysisSection {
        kind: SectionKind::QuestionRelated,
        title: "与你的问题相关",
        points: question_points(&request),
    });
    if !request.selected_private_fragments.is_empty() {
        sections.push(AnalysisSection {
            kind: SectionKind::YourNotes,
            title: "你选择发送的记录",
            points: private_points(&request),
        });
    }
    sections.push(AnalysisSection {
        kind: SectionKind::ToConfirm,
        title: "仍需确认",
        points: confirmation_points(&request),
    });

    let private_count = request.selected_private_fragments.len();
    AnalysisResponse {
        analysis_id: format!(
            "analysis-{}-{}",
            Utc::now().timestamp_micros(),
            ANALYSIS_COUNTER.fetch_add(1, Ordering::Relaxed)
        ),
        operation: request.operation,
        question: request.question.clone(),
        created_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        provider: AnalysisProvider {
            id: "simulated-organizer",
            label: "模拟整理服务",
            simulated: true,
            retention: "none",
        },
        received: ReceivedMaterial {
            subject_ids: request
                .subjects
                .iter()
                .map(|subject| subject.id.clone())
                .collect(),
            evidence_refs: request
                .evidence
                .iter()
                .map(|evidence| evidence.reference.clone())
                .collect(),
            private_fragment_ids: request
                .selected_private_fragments
                .iter()
                .map(|fragment| fragment.id.clone())
                .collect(),
        },
        sections,
        caveats: vec![
            "这是确定性模拟整理服务的输出，不是模型判断；请对照原始公开来源核实。".into(),
            format!("本次仅收到用户明确选择的{private_count}条私人记录。"),
            "服务不存储本次提交的公开依据、问题或私人记录。".into(),
        ],
    }
}

pub fn simulation_timing(request: &AnalysisRequest) -> (SimulationOutcome, u64) {
    request
        .simulation
        .as_ref()
        .map_or((SimulationOutcome::Ok, 600), |simulation| {
            (simulation.outcome, simulation.delay_ms.unwrap_or(600))
        })
}

fn difference_points(request: &AnalysisRequest) -> Vec<AnalysisPoint> {
    let mut groups: Vec<(&str, Vec<&AnalysisEvidence>)> = Vec::new();
    for evidence in &request.evidence {
        if let Some((_, entries)) = groups
            .iter_mut()
            .find(|(aspect, _)| *aspect == evidence.aspect)
        {
            entries.push(evidence);
        } else {
            groups.push((&evidence.aspect, vec![evidence]));
        }
    }
    groups
        .into_iter()
        .map(|(aspect, entries)| {
            let mut per_subject = Vec::new();
            for evidence in entries {
                if !per_subject
                    .iter()
                    .any(|item: &&AnalysisEvidence| item.subject_id == evidence.subject_id)
                {
                    per_subject.push(evidence);
                }
            }
            let text = if per_subject.len() >= 2 {
                format!(
                    "{aspect}：{}",
                    per_subject
                        .iter()
                        .map(|evidence| format!(
                            "「{}」{}",
                            subject_name(request, &evidence.subject_id),
                            snippet(&evidence.text, 80)
                        ))
                        .collect::<Vec<_>>()
                        .join("；")
                )
            } else {
                let evidence = per_subject[0];
                format!(
                    "{aspect}：仅「{}」有资料：{}；其他对象依据不足",
                    subject_name(request, &evidence.subject_id),
                    snippet(&evidence.text, 80)
                )
            };
            AnalysisPoint {
                text,
                evidence_refs: per_subject
                    .iter()
                    .map(|evidence| evidence.reference.clone())
                    .collect(),
                private_fragment_ids: Vec::new(),
            }
        })
        .collect()
}

fn question_points(request: &AnalysisRequest) -> Vec<AnalysisPoint> {
    let question_tokens = tokens(&request.question);
    let mut ranked = request
        .evidence
        .iter()
        .enumerate()
        .filter_map(|(index, evidence)| {
            let matched = matching_terms(&question_tokens, &tokens(&evidence.text));
            (!matched.is_empty()).then_some((matched.len(), index, evidence, matched))
        })
        .collect::<Vec<_>>();
    ranked.sort_by_key(|(score, index, _, _)| (std::cmp::Reverse(*score), *index));
    let points = ranked
        .into_iter()
        .take(3)
        .map(|(_, _, evidence, matched)| AnalysisPoint {
            text: format!(
                "你的问题提到「{}」——「{}」的{}：{}",
                matched.into_iter().take(2).collect::<Vec<_>>().join("、"),
                subject_name(request, &evidence.subject_id),
                evidence.aspect,
                snippet(&evidence.text, 80)
            ),
            evidence_refs: vec![evidence.reference.clone()],
            private_fragment_ids: Vec::new(),
        })
        .collect::<Vec<_>>();
    if points.is_empty() {
        vec![AnalysisPoint {
            text: "现有公开依据与这个问题没有直接词项重合，不能据此作出判断。".into(),
            evidence_refs: Vec::new(),
            private_fragment_ids: Vec::new(),
        }]
    } else {
        points
    }
}

fn private_points(request: &AnalysisRequest) -> Vec<AnalysisPoint> {
    request
        .selected_private_fragments
        .iter()
        .map(|fragment| {
            let fragment_tokens = tokens(&fragment.text);
            let best = request
                .evidence
                .iter()
                .enumerate()
                .filter(|(_, evidence)| {
                    fragment
                        .subject_id
                        .as_ref()
                        .is_none_or(|id| id == &evidence.subject_id)
                })
                .map(|(index, evidence)| {
                    (
                        matching_terms(&fragment_tokens, &tokens(&evidence.text)).len(),
                        index,
                        evidence,
                    )
                })
                .filter(|(score, _, _)| *score > 0)
                .max_by_key(|(score, index, _)| (*score, std::cmp::Reverse(*index)));
            let short = snippet(&fragment.text, 40);
            let (text, evidence_refs) = match (fragment.kind, best) {
                (PrivateFragmentKind::Reason, Some((_, _, evidence))) => (
                    format!(
                        "你选择发送的理由「{short}」可对照：「{}」的{}：{}",
                        subject_name(request, &evidence.subject_id),
                        evidence.aspect,
                        snippet(&evidence.text, 80)
                    ),
                    vec![evidence.reference.clone()],
                ),
                (PrivateFragmentKind::Question, Some((_, _, evidence))) => (
                    format!(
                        "你的待问「{short}」：现有资料中「{}」的{}提到：{}",
                        subject_name(request, &evidence.subject_id),
                        evidence.aspect,
                        snippet(&evidence.text, 80)
                    ),
                    vec![evidence.reference.clone()],
                ),
                (PrivateFragmentKind::Reason, None) => (
                    format!(
                        "你选择发送的理由「{short}」在现有资料中没有直接覆盖，建议向原站或对方确认"
                    ),
                    Vec::new(),
                ),
                (PrivateFragmentKind::Question, None) => (
                    format!("你的待问「{short}」：现有资料没有覆盖，建议向原站或对方确认"),
                    Vec::new(),
                ),
            };
            AnalysisPoint {
                text,
                evidence_refs,
                private_fragment_ids: vec![fragment.id.clone()],
            }
        })
        .collect()
}

fn confirmation_points(request: &AnalysisRequest) -> Vec<AnalysisPoint> {
    let points = request
        .evidence
        .iter()
        .filter(|evidence| {
            evidence.aspect == "unknowns"
                || evidence.aspect.contains("未知")
                || evidence.aspect.contains("确认")
        })
        .map(|evidence| AnalysisPoint {
            text: format!(
                "「{}」：{}",
                subject_name(request, &evidence.subject_id),
                snippet(&evidence.text, 80)
            ),
            evidence_refs: vec![evidence.reference.clone()],
            private_fragment_ids: Vec::new(),
        })
        .collect::<Vec<_>>();
    if points.is_empty() {
        vec![AnalysisPoint {
            text: "没有单列的待确认依据；作出决定前仍建议回到原站核对最新条件。".into(),
            evidence_refs: Vec::new(),
            private_fragment_ids: Vec::new(),
        }]
    } else {
        points
    }
}

fn subject_name<'a>(request: &'a AnalysisRequest, id: &str) -> &'a str {
    request
        .subjects
        .iter()
        .find(|subject| subject.id == id)
        .map_or("未知对象", |subject| subject.name.as_str())
}

fn tokens(text: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut ascii = String::new();
    let mut cjk_run = Vec::new();
    let flush_ascii = |ascii: &mut String, result: &mut Vec<String>| {
        if ascii.len() >= 2 && !STOPWORDS.contains(&ascii.as_str()) && !result.contains(ascii) {
            result.push(std::mem::take(ascii));
        } else {
            ascii.clear();
        }
    };
    let flush_cjk = |run: &mut Vec<char>, result: &mut Vec<String>| {
        for pair in run.windows(2) {
            let token = pair.iter().collect::<String>();
            if !STOPWORDS.contains(&token.as_str()) && !result.contains(&token) {
                result.push(token);
            }
        }
        run.clear();
    };
    for character in text.chars() {
        if character.is_ascii_alphanumeric() {
            flush_cjk(&mut cjk_run, &mut result);
            ascii.push(character.to_ascii_lowercase());
        } else if is_cjk(character) {
            flush_ascii(&mut ascii, &mut result);
            cjk_run.push(character);
        } else {
            flush_ascii(&mut ascii, &mut result);
            flush_cjk(&mut cjk_run, &mut result);
        }
    }
    flush_ascii(&mut ascii, &mut result);
    flush_cjk(&mut cjk_run, &mut result);
    result
}

fn matching_terms<'a>(left: &'a [String], right: &[String]) -> Vec<&'a str> {
    left.iter()
        .filter(|term| right.contains(term))
        .map(String::as_str)
        .collect()
}

fn is_cjk(character: char) -> bool {
    matches!(character as u32, 0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF)
}

fn snippet(text: &str, limit: usize) -> String {
    let sentence = text
        .split_inclusive(['。', '！', '？', '.', '!', '?'])
        .next()
        .unwrap_or(text)
        .trim();
    sentence.chars().take(limit).collect()
}

fn trim(value: &mut String) {
    *value = value.trim().to_owned();
}

fn bounded_text(
    value: &str,
    min: usize,
    max: usize,
    field: &str,
    allow_newline: bool,
    fields: &mut Vec<ValidationIssue>,
) {
    let length = value.chars().count();
    if length < min || length > max {
        issue(fields, field, "is outside the allowed character length");
    }
    if value
        .chars()
        .any(|character| character.is_control() && !(allow_newline && character == '\n'))
    {
        issue(fields, field, "contains disallowed control characters");
    }
}

fn issue(fields: &mut Vec<ValidationIssue>, field: &str, message: &'static str) {
    fields.push(ValidationIssue {
        field: field.to_owned(),
        message,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> AnalysisRequest {
        AnalysisRequest {
            operation: AnalysisOperation::Compare,
            question: "哪个更适合机器学习？".into(),
            subjects: vec![
                AnalysisSubject {
                    id: "a".into(),
                    name: "甲".into(),
                    kind: SubjectKind::Advisor,
                },
                AnalysisSubject {
                    id: "b".into(),
                    name: "乙".into(),
                    kind: SubjectKind::Advisor,
                },
            ],
            evidence: vec![
                AnalysisEvidence {
                    reference: "e1".into(),
                    subject_id: "a".into(),
                    aspect: "方向".into(),
                    text: "机器学习与系统研究。第二句。".into(),
                    source_title: None,
                    source_url: None,
                    collected_at: None,
                },
                AnalysisEvidence {
                    reference: "e2".into(),
                    subject_id: "b".into(),
                    aspect: "unknowns".into(),
                    text: "招生情况需要确认。".into(),
                    source_title: None,
                    source_url: None,
                    collected_at: None,
                },
            ],
            selected_private_fragments: Vec::new(),
            simulation: None,
        }
    }

    #[test]
    fn organizes_evidence_without_adding_private_section() {
        let response = organize(validate(request()).unwrap());
        assert_eq!(response.received.subject_ids, ["a", "b"]);
        assert_eq!(response.received.evidence_refs, ["e1", "e2"]);
        assert!(response
            .sections
            .iter()
            .all(|section| !matches!(section.kind, SectionKind::YourNotes)));
        assert!(response.sections.iter().any(|section| matches!(
            section.kind,
            SectionKind::QuestionRelated
        ) && !section.points[0]
            .evidence_refs
            .is_empty()));
    }

    #[test]
    fn validation_reports_reference_and_compare_errors() {
        let mut input = request();
        input.subjects.truncate(1);
        input.evidence[1].subject_id = "missing".into();
        let error = validate(input).unwrap_err();
        assert!(error.fields.iter().any(|field| field.field == "subjects"));
        assert!(error
            .fields
            .iter()
            .any(|field| field.field == "evidence[1].subjectId"));
    }

    #[test]
    fn tokenizer_uses_lowercase_words_and_cjk_bigrams() {
        assert_eq!(
            tokens("Machine LEARNING 机器学习 可以"),
            ["machine", "learning", "机器", "器学", "学习"]
        );
    }
}
