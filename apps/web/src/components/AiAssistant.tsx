import {
  CampusAgoraApiError,
  createAiCompletion,
  getAiProviders,
} from "@campus-agora/api-client";
import {
  Banner,
  Button,
  Checkbox,
  Details,
  FormControl,
  Heading,
  Link,
  SegmentedControl,
  Select,
  Spinner,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@primer/react";
import { useEffect, useRef, useState } from "react";
import type { Advisor } from "../lib/advisors";
import {
  type AiProvider,
  type AiSelection,
  aiFailureState,
  buildAiRequest,
} from "../lib/ai-request";
import type { ExplorationTopic } from "../lib/exploration-store";

type SendState = "idle" | "waiting" | "success" | "error" | "uncertain";

export function AiAssistant({
  candidates,
  topic,
}: {
  candidates: Advisor[];
  topic?: ExplorationTopic;
}) {
  const [provider, setProvider] = useState<AiProvider>("school");
  const [schoolConfigured, setSchoolConfigured] = useState<boolean>();
  const [schoolModel, setSchoolModel] = useState("deepseek-v4-pro");
  const [availabilityError, setAvailabilityError] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [task, setTask] = useState("");
  const [candidateId, setCandidateId] = useState(candidates[0]?.candidateId ?? "");
  const [includePublic, setIncludePublic] = useState(false);
  const [privateCandidateId, setPrivateCandidateId] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [responseModel, setResponseModel] = useState("");
  const controller = useRef<AbortController>();
  const run = useRef(0);

  useEffect(() => {
    let active = true;
    getAiProviders()
      .then((result) => {
        if (!active) return;
        setSchoolConfigured(result.school.configured);
        setSchoolModel(result.school.model);
      })
      .catch(() => {
        if (active) setAvailabilityError("暂时无法确认学校AI配置；发送时会再次检查。");
      });
    return () => {
      active = false;
      run.current += 1;
      controller.current?.abort();
    };
  }, []);

  const candidate = candidates.find((item) => item.candidateId === candidateId);
  const selection: AiSelection = {
    provider,
    task,
    candidate,
    includePublicContext: includePublic,
    privateCandidateId: privateCandidateId || undefined,
    topic,
    custom: { baseUrl, model, apiKey },
  };
  const request = buildAiRequest(selection);
  const privateRecords = (topic?.candidates ?? []).filter(
    (record) => record.reason.trim().length > 0,
  );
  const waiting = sendState === "waiting";
  const customIncomplete =
    provider === "custom" && (!baseUrl.trim() || !model.trim() || !apiKey.trim());

  async function send() {
    if (!request.task || customIncomplete || waiting) return;
    const currentRun = ++run.current;
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    setAnswer("");
    setSendState("waiting");
    try {
      const result = await createAiCompletion(request, { signal: abort.signal });
      if (run.current !== currentRun) return;
      setAnswer(result.content);
      setResponseModel(result.model);
      setSendState("success");
    } catch (failure) {
      if (run.current !== currentRun) return;
      const state = aiFailureState(failure);
      // Only the AI endpoint's own errors carry a user-facing message; proxy or
      // network failures fall back to the possibly-sent notice.
      const ownMessage =
        failure instanceof CampusAgoraApiError &&
        failure.status > 0 &&
        (state === "error" || failure.code.startsWith("ai_"));
      setError(
        ownMessage
          ? failure.message
          : "连接中断或服务未响应；发送状态未确认，可能已发送。可在核对内容后主动重试。",
      );
      setSendState(state);
    }
  }

  function cancel() {
    run.current += 1;
    controller.current?.abort();
    setError(
      "已停止等待；发送状态未确认，可能已发送。中止不会撤回服务方已收到的内容。",
    );
    setSendState("uncertain");
  }

  return (
    <Stack as="section" gap="normal">
      <Heading as="h2" variant="small">
        AI 助手
      </Heading>
      <Text as="p">
        每次只发送当前任务和下方明确选择的材料，不携带历史对话、其他笔记或其他主题。AI解释不替代来源核对。
      </Text>
      {availabilityError && (
        <Banner variant="warning" layout="compact" title={availabilityError} />
      )}
      <SegmentedControl aria-label="AI提供方">
        <SegmentedControl.Button
          selected={provider === "school"}
          disabled={waiting}
          onClick={() => setProvider("school")}
        >
          使用学校词元计划
        </SegmentedControl.Button>
        <SegmentedControl.Button
          selected={provider === "custom"}
          disabled={waiting}
          onClick={() => setProvider("custom")}
        >
          使用自己的AI
        </SegmentedControl.Button>
      </SegmentedControl>
      {provider === "school" ? (
        <Stack gap="condensed">
          <Text>接收服务：中国科大大模型公共服务平台 · 模型 {schoolModel}</Text>
          <Text size="small">
            {schoolConfigured === false
              ? "服务端尚未配置学校API Key，当前不能发送。"
              : schoolConfigured
                ? "学校API Key由服务端配置，不会在浏览器中显示。"
                : "正在确认学校服务配置。"}{" "}
            <Link
              href="https://llm.ustc.edu.cn/guide/api/"
              target="_blank"
              rel="noreferrer"
            >
              查看学校API指南
            </Link>
          </Text>
        </Stack>
      ) : (
        <Stack gap="normal">
          <Text size="small">
            接收服务由下方地址决定。密钥仅随本次请求经项目后端转发，不写入浏览器存储或项目数据库；请确认该服务允许这样使用。
          </Text>
          <FormControl required>
            <FormControl.Label>OpenAI兼容API基础地址</FormControl.Label>
            <TextInput
              block
              value={baseUrl}
              disabled={waiting}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </FormControl>
          <FormControl required>
            <FormControl.Label>模型</FormControl.Label>
            <TextInput
              block
              value={model}
              disabled={waiting}
              onChange={(event) => setModel(event.target.value)}
              placeholder="例如 gpt-4.1-mini"
              maxLength={200}
            />
          </FormControl>
          <FormControl required>
            <FormControl.Label>自己的API Key</FormControl.Label>
            <TextInput
              block
              type="password"
              autoComplete="off"
              value={apiKey}
              disabled={waiting}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <FormControl.Caption>
              仅保留在当前页面内存中，离开此页面后清除。
            </FormControl.Caption>
          </FormControl>
        </Stack>
      )}
      <FormControl required>
        <FormControl.Label>本次问题</FormControl.Label>
        <Textarea
          block
          rows={3}
          value={task}
          disabled={waiting}
          onChange={(event) => setTask(event.target.value)}
          placeholder="例如 根据所选公开资料，比较研究问题与仍需确认的条件"
          maxLength={2000}
        />
        <FormControl.Caption>
          提交这个问题即表示选择把它发送给当前AI服务。
        </FormControl.Caption>
      </FormControl>
      <Stack gap="condensed">
        <Text weight="semibold">可选材料</Text>
        <FormControl disabled={waiting || !candidate}>
          <Checkbox
            checked={includePublic}
            onChange={(event) => setIncludePublic(event.target.checked)}
          />
          <FormControl.Label>发送一名候选的公开资料与来源摘要</FormControl.Label>
        </FormControl>
        <FormControl disabled={waiting || !includePublic}>
          <FormControl.Label>公开候选资料</FormControl.Label>
          <Select
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
          >
            {candidates.map((item) => (
              <Select.Option key={item.candidateId} value={item.candidateId}>
                {item.name} · {item.institution}
              </Select.Option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormControl.Label>私人理由（最多一条）</FormControl.Label>
          <Select
            value={privateCandidateId}
            disabled={waiting || privateRecords.length === 0}
            onChange={(event) => setPrivateCandidateId(event.target.value)}
          >
            <Select.Option value="">不发送私人理由</Select.Option>
            {privateRecords.map((record) => (
              <Select.Option
                key={record.candidate.candidateId}
                value={record.candidate.candidateId}
              >
                {record.candidate.name}的已保存理由
              </Select.Option>
            ))}
          </Select>
          <FormControl.Caption>
            {topic
              ? privateRecords.length
                ? "只读取这里明确选中的一条；主题问题、偏好、疑问和其他理由不会发送。"
                : "当前主题没有已保存的私人理由。"
              : "未选择主题，不发送私人内容。"}
          </FormControl.Caption>
        </FormControl>
      </Stack>
      <Stack gap="condensed" aria-label="本次发送内容">
        <Text weight="semibold">本次发送内容</Text>
        <Text>用途：回答本次机会探索问题</Text>
        <Text>接收服务：{provider === "school" ? "学校词元计划" : baseUrl}</Text>
        <Text>问题：{request.task || "尚未填写"}</Text>
        <Text>个人内容：{request.personalContext ?? "未选择"}</Text>
        {request.publicContext ? (
          <Details>
            <Details.Summary>公开依据：已选择，展开查看全文</Details.Summary>
            <Text>{request.publicContext}</Text>
          </Details>
        ) : (
          <Text>公开依据：未选择</Text>
        )}
      </Stack>
      {sendState === "idle" && <Text size="small">尚未发送</Text>}
      {waiting && (
        <Banner variant="info" layout="compact">
          <Banner.Title>已发送，等待结果</Banner.Title>
        </Banner>
      )}
      {sendState === "uncertain" && (
        <Banner variant="warning" layout="compact" title="发送状态未确认，可能已发送" />
      )}
      {error && <Banner variant="critical" layout="compact" title={error} />}
      {answer && (
        <Stack gap="condensed" aria-label="AI回答">
          <Text weight="semibold">AI回答 · {responseModel}</Text>
          <Text as="p">{answer}</Text>
          <Text size="small">
            结果仅保留在当前页面；请核对来源后再保存为自己的判断。
          </Text>
        </Stack>
      )}
      <Stack direction="horizontal" wrap="wrap" align="center">
        <Button
          variant="primary"
          disabled={
            !request.task ||
            customIncomplete ||
            waiting ||
            (schoolConfigured === false && provider === "school")
          }
          onClick={send}
        >
          {sendState === "uncertain" || sendState === "error"
            ? "核对后重试"
            : "发送本次所选内容"}
        </Button>
        {waiting && (
          <>
            <Spinner size="small" />
            <Button onClick={cancel}>中止等待</Button>
          </>
        )}
      </Stack>
    </Stack>
  );
}
