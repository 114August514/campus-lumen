//! Deterministic, in-process simulated organizer for explicit user-selected material.

use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::ai::ChatMessage;
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
    pub provider: Option<AnalysisProviderChoice>,
    #[serde(default)]
    pub simulation: Option<SimulationOptions>,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisProviderChoice {
    #[default]
    Simulated,
    School,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
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

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
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
            model: None,
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
pub fn model_messages(request: &AnalysisRequest) -> Vec<ChatMessage> {
    let system = "你是 Campus Lumen 整理助手。只依据给出的公开依据和用户选择的个人内容；区分事实、解释和未知；未知保持未知、不当作负面；不打分、不排名、不替用户决定；不编造。输出严格使用以下二级标题（无内容的节省略，“回应你选择的内容”仅在给了个人内容时输出）：## 差异要点、## 与你的问题有关、## 回应你选择的内容、## 仍需确认。每节 1–3 条，每条一行以 “- ” 开头、不超过 80 字；引用只放在句末，用方括号标注，如 [e1][e3]，回应个人内容时加 [P1]；句子中间不要写引用编号。";
    let subjects = request
        .subjects
        .iter()
        .map(|subject| format!("- {}（{}）", subject.name, subject.id))
        .collect::<Vec<_>>()
        .join("\n");
    let evidence = request
        .evidence
        .iter()
        .map(|item| {
            let source = [
                item.source_title.as_deref(),
                item.source_url.as_deref(),
                item.collected_at.as_deref(),
            ]
            .into_iter()
            .flatten()
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(" ");
            format!(
                "[{}] 对象：{}｜方面：{}｜{}（来源：{}）",
                item.reference,
                subject_name(request, &item.subject_id),
                if item.aspect.is_empty() {
                    "仍需确认"
                } else {
                    &item.aspect
                },
                item.text,
                if source.is_empty() {
                    "未提供"
                } else {
                    &source
                }
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let personal = if request.selected_private_fragments.is_empty() {
        "（未选择个人内容）".to_owned()
    } else {
        request
            .selected_private_fragments
            .iter()
            .enumerate()
            .map(|(index, fragment)| {
                let subject = fragment
                    .subject_id
                    .as_deref()
                    .map(|id| subject_name(request, id))
                    .unwrap_or("未指定对象");
                let kind = match fragment.kind {
                    PrivateFragmentKind::Reason => "理由",
                    PrivateFragmentKind::Question => "待问",
                };
                format!("[P{}] {}的{}：{}", index + 1, subject, kind, fragment.text)
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    let user = format!(
        "问题：{}\n\n对象列表：\n{}\n\n公开依据：\n{}\n\n个人内容：\n{}",
        request.question,
        subjects,
        if evidence.is_empty() {
            "（未提供公开依据）"
        } else {
            &evidence
        },
        personal
    );
    vec![
        ChatMessage {
            role: "system".into(),
            content: system.into(),
        },
        ChatMessage {
            role: "user".into(),
            content: user,
        },
    ]
}

pub fn organize_from_model(
    request: AnalysisRequest,
    content: &str,
    model: &str,
) -> AnalysisResponse {
    let mut parsed: Vec<(SectionKind, Vec<AnalysisPoint>)> = Vec::new();
    let mut current = None;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(kind) = heading_kind(line) {
            current = Some(kind);
            continue;
        }
        let Some(text) = bullet_text(line) else {
            continue;
        };
        let Some(kind) = current else {
            continue;
        };
        if kind == SectionKind::YourNotes && request.selected_private_fragments.is_empty() {
            continue;
        }
        let points =
            if let Some((_, points)) = parsed.iter_mut().find(|(existing, _)| *existing == kind) {
                points
            } else {
                parsed.push((kind, Vec::new()));
                &mut parsed.last_mut().expect("just inserted section").1
            };
        if points.len() < 5 {
            points.push(parse_model_point(text, &request));
        }
    }
    parsed.retain(|(_, points)| !points.is_empty());
    let fallback = parsed.is_empty();
    if fallback {
        let text = content.trim().chars().take(4_000).collect::<String>();
        parsed.push((
            SectionKind::Differences,
            vec![AnalysisPoint {
                text,
                evidence_refs: Vec::new(),
                private_fragment_ids: Vec::new(),
            }],
        ));
    }
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
            id: "ustc-llm",
            label: "中国科大大模型公共服务平台（词元计划）",
            simulated: false,
            retention: "unverified",
            model: Some(model.to_owned()),
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
                .map(|item| item.reference.clone())
                .collect(),
            private_fragment_ids: request
                .selected_private_fragments
                .iter()
                .map(|fragment| fragment.id.clone())
                .collect(),
        },
        sections: parsed
            .into_iter()
            .map(|(kind, points)| AnalysisSection {
                kind,
                title: if fallback {
                    "整理结果"
                } else {
                    section_title(kind)
                },
                points,
            })
            .collect(),
        caveats: vec![
            format!("由词元计划平台模型 {model} 生成，可能有误，请对照来源核实。"),
            format!(
                "本次发送了你选择的 {private_count} 条个人内容；平台的日志与保留规则尚未核实。"
            ),
            "本项目后端不保存本次提交的内容。".into(),
        ],
    }
}

fn heading_kind(line: &str) -> Option<SectionKind> {
    let line = line.trim();
    let markdown_heading = line.starts_with('#');
    let emphasized_heading = line.starts_with("**") && line.ends_with("**");
    let mut heading = line.trim_matches('*').trim();
    if markdown_heading {
        heading = heading.trim_start_matches('#').trim();
    }
    let exact_title = matches!(
        heading,
        "差异要点" | "与你的问题有关" | "回应你选择的内容" | "仍需确认"
    );
    if !(markdown_heading || emphasized_heading || exact_title) {
        return None;
    }
    if heading.contains("回应") || heading.contains("你选择") {
        Some(SectionKind::YourNotes)
    } else if heading.contains("差异") {
        Some(SectionKind::Differences)
    } else if heading.contains("问题") {
        Some(SectionKind::QuestionRelated)
    } else if heading.contains("确认") {
        Some(SectionKind::ToConfirm)
    } else {
        None
    }
}

fn bullet_text(line: &str) -> Option<&str> {
    if let Some(rest) = line
        .strip_prefix("- ")
        .or_else(|| line.strip_prefix("* "))
        .or_else(|| line.strip_prefix("• "))
    {
        return Some(rest.trim());
    }
    let digit_count = line.chars().take_while(char::is_ascii_digit).count();
    if digit_count == 0 {
        return None;
    }
    let rest = &line[digit_count..];
    rest.strip_prefix('.')
        .or_else(|| rest.strip_prefix('、'))
        .or_else(|| rest.strip_prefix(')'))
        .map(str::trim)
}

fn parse_model_point(text: &str, request: &AnalysisRequest) -> AnalysisPoint {
    let mut cleaned = String::new();
    let mut evidence_refs = Vec::new();
    let mut private_fragment_ids = Vec::new();
    let characters = text.chars().collect::<Vec<_>>();
    let mut index = 0;
    while index < characters.len() {
        let (close, bracketed) = match characters[index] {
            '[' => (']', true),
            '【' => ('】', true),
            _ => ('\0', false),
        };
        if !bracketed {
            cleaned.push(characters[index]);
            index += 1;
            continue;
        }
        let Some(relative_end) = characters[index + 1..].iter().position(|c| *c == close) else {
            cleaned.push(characters[index]);
            index += 1;
            continue;
        };
        let end = index + 1 + relative_end;
        let group = characters[index + 1..end].iter().collect::<String>();
        let tokens = group
            .split([',', '，', '、', ' '])
            .filter(|token| !token.is_empty())
            .collect::<Vec<_>>();
        let mut all_recognized = !tokens.is_empty();
        for token in tokens {
            let lower = token.to_ascii_lowercase();
            if lower.strip_prefix('e').is_some_and(|digits| {
                !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit())
            }) {
                if let Some(reference) = request
                    .evidence
                    .iter()
                    .find(|item| item.reference == token)
                    .map(|item| item.reference.clone())
                {
                    if !evidence_refs.contains(&reference) {
                        evidence_refs.push(reference);
                    }
                }
            } else if lower.strip_prefix('p').is_some_and(|digits| {
                !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit())
            }) {
                let position = lower[1..].parse::<usize>().ok();
                if let Some(fragment) = position
                    .and_then(|position| position.checked_sub(1))
                    .and_then(|position| request.selected_private_fragments.get(position))
                {
                    if !private_fragment_ids.contains(&fragment.id) {
                        private_fragment_ids.push(fragment.id.clone());
                    }
                }
            } else {
                all_recognized = false;
            }
        }
        if !all_recognized {
            cleaned.extend(characters[index..=end].iter());
        }
        index = end + 1;
    }
    // Removing a citation can leave a space before punctuation ("交叉 ；").
    let mut tidy = String::with_capacity(cleaned.len());
    for character in cleaned.trim().chars() {
        if matches!(character, '；' | '。' | '，' | '、' | '：' | '！' | '？') {
            while tidy.ends_with(' ') {
                tidy.pop();
            }
        }
        tidy.push(character);
    }
    AnalysisPoint {
        text: tidy,
        evidence_refs,
        private_fragment_ids,
    }
}

fn section_title(kind: SectionKind) -> &'static str {
    match kind {
        SectionKind::Differences => "差异要点",
        SectionKind::QuestionRelated => "与你的问题有关",
        SectionKind::YourNotes => "回应你选择的内容",
        SectionKind::ToConfirm => "仍需确认",
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
            provider: None,
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
    #[test]
    fn model_messages_include_only_supplied_selected_fragments() {
        let mut input = request();
        input.selected_private_fragments.push(PrivateFragment {
            id: "chosen".into(),
            kind: PrivateFragmentKind::Reason,
            subject_id: Some("a".into()),
            text: "只发送这一条".into(),
        });
        let messages = model_messages(&input);
        assert!(messages[1].content.contains("只发送这一条"));
        assert!(messages[1].content.contains("[P1] 甲的理由"));
        assert!(!messages[1].content.contains("未选择的私人内容"));
    }

    #[test]
    fn parses_headings_references_and_private_mapping() {
        let mut input = request();
        input.selected_private_fragments.push(PrivateFragment {
            id: "fragment-a".into(),
            kind: PrivateFragmentKind::Question,
            subject_id: Some("a".into()),
            text: "实验室节奏如何".into(),
        });
        let output = organize_from_model(
            input,
            "## 差异要点\n- 甲偏系统 [e1][e999]\n**与你的问题有关**\n1. 乙的信息待确认【e2】\n## 回应你选择的内容\n• 可以继续询问 [P1]\n## 仍需确认\n* 更新时间未知 [E1, nonsense]",
            "model-x",
        );
        assert_eq!(output.sections.len(), 4);
        assert_eq!(output.sections[0].title, "差异要点");
        assert_eq!(output.sections[0].points[0].evidence_refs, ["e1"]);
        assert_eq!(
            output.sections[2].points[0].private_fragment_ids,
            ["fragment-a"]
        );
        assert!(output.sections[0].points[0].text.contains("甲偏系统"));
        assert!(output.sections[3].points[0].text.contains("[E1, nonsense]"));
    }

    #[test]
    fn model_parser_falls_back_and_omits_private_section_without_fragments() {
        let input = request();
        let output = organize_from_model(
            input,
            "没有采用要求格式\n## 回应你选择的内容\n- 不应出现 [P1]",
            "model-x",
        );
        assert_eq!(output.sections.len(), 1);
        assert_eq!(output.sections[0].kind, SectionKind::Differences);
        assert_eq!(output.sections[0].title, "整理结果");
        assert!(output.sections[0].points[0]
            .text
            .contains("没有采用要求格式"));
        assert!(output
            .sections
            .iter()
            .all(|section| section.kind != SectionKind::YourNotes));
    }
}
