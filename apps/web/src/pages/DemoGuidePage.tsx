import {
  Banner,
  Button,
  FormControl,
  Heading,
  Label,
  Link,
  Radio,
  RadioGroup,
  Stack,
  Text,
} from "@primer/react";
import { type Route, routeHref } from "../app/router";
import { findItem, toSaveTarget } from "../lib/catalog";
import { type ReplayScenario, replayScenarios } from "../lib/demo-replay";
import { type AnalysisOutcome, useAppState } from "../state/app-state";

type Mode = "实时" | "已有资料" | "本地" | "模拟" | "回放";

const modeVariant: Record<
  Mode,
  "accent" | "secondary" | "success" | "done" | "attention"
> = {
  实时: "accent",
  已有资料: "secondary",
  本地: "success",
  模拟: "done",
  回放: "attention",
};

interface Step {
  title: string;
  expect: string;
  modes: Mode[];
  route?: Route;
}

const steps: Step[] = [
  {
    title: "从首页写下问题，开始探索",
    expect: "不建主题也能进入“① 探索”；问题、类型和条件可以随时修改，不会自动联网。",
    modes: ["本地"],
    route: {
      name: "explore",
      stage: "explore",
      q: "想找本科阶段能参与的 AI 系统方向短期科研",
    },
  },
  {
    title: "在“② 发现”中查看已有资料的匹配",
    expect:
      "每条标“已有资料”和采集日期，途径状态分“有依据 / 未知”；加入对象需要先保存为探索主题。",
    modes: ["已有资料"],
    route: { name: "explore", stage: "discover", q: "AI 系统 短期科研" },
  },
  {
    title: "直读一个官方页（江祖铭主页）",
    expect:
      "运行记录逐步显示读取、结果和结束状态；正文标“本次取得”和取得时间，可关联到江祖铭并保存为依据。失败会如实显示失败原因。",
    modes: ["实时"],
    route: { name: "item", id: "zuming-jiang" },
  },
  {
    title: "载入两个合成示例主题，进入“③ 处理”",
    expect: "对象表可按保留 / 待定 / 排除切换；宋卓然的职称冲突集中提示，保留待核。",
    modes: ["本地"],
  },
  {
    title: "比较江祖铭与宋卓然，切换到“短期参与”",
    expect:
      "同一行比较同一个问题；“未提及”不等于不接收，不打分；每格可以查看依据原文。",
    modes: ["已有资料"],
    route: {
      name: "compare",
      ids: ["zuming-jiang", "zhuoran-song"],
      perspective: "short-term",
    },
  },
  {
    title: "在“仍需确认”行对宋卓然补查",
    expect: "查询预填当前问题和姓名；保存后该格显示“补查所得（日期）”。",
    modes: ["实时"],
    route: {
      name: "compare",
      ids: ["zuming-jiang", "zhuoran-song"],
      perspective: "short-term",
    },
  },
  {
    title: "按问题整理差异，只勾选一条理由",
    expect:
      "发送前列出公开依据和本主题的个人内容（默认不选）；返回后服务回显收到的条数，与勾选一致；结果标“模拟服务输出”。",
    modes: ["模拟"],
    route: {
      name: "compare",
      ids: ["zuming-jiang", "zhuoran-song"],
      perspective: "short-term",
    },
  },
  {
    title: "把 AI 模拟设为“超时”，再发送一次",
    expect:
      "状态从“已发出，等待结果”变为“发送状态未确认，可能已发送”；停止等待不显示为已撤回。",
    modes: ["模拟"],
  },
  {
    title: "同一流程换一类：交流与暑校",
    expect:
      "MPI 与 ISTA 的项目入口走同样的详情、比较和直读；比较维度换成概况、条件、支持与时间。",
    modes: ["已有资料", "实时"],
    route: { name: "compare", ids: ["mpi-internship", "ista-internship"] },
  },
  {
    title: "资料库直达：搜“GPU”，打开原站",
    expect:
      "只查入口时搜到即可离开，不需要建主题；条目注明“可申请不等于获批”，GPU 等条件未确认的写明待核。",
    modes: ["已有资料"],
    route: { name: "library", q: "GPU" },
  },
  {
    title: "切换到另一个合成主题，查看同一位导师",
    expect: "两个主题对江祖铭的理由各不相同，互不覆盖；删除一个主题不影响另一个。",
    modes: ["本地"],
    route: { name: "sessions" },
  },
  {
    title: "刷新页面",
    expect: "回到上次打开的主题和阶段；记录只在这个浏览器的同一地址下恢复。",
    modes: ["本地"],
  },
  {
    title: "开启发现回放“中止后迟到”，查找后点中止",
    expect: "已收到的一条保留，迟到的结果不写入；回放内容标“演示回放”且不能保存。",
    modes: ["回放"],
    route: { name: "explore", stage: "discover", q: "江祖铭 RA" },
  },
];

const syntheticSuffix = "（合成示例）";

const outcomes: { id: AnalysisOutcome; label: string; note: string }[] = [
  { id: "ok", label: "正常", note: "约 0.6 秒后返回" },
  { id: "delay", label: "延迟 3 秒", note: "可以看到“已发出，等待结果”" },
  { id: "hang", label: "超时", note: "服务 20 秒不回应，前端 12 秒后显示送达不明" },
  { id: "error", label: "服务错误", note: "服务收到请求后返回错误" },
];

export default function DemoGuidePage() {
  const { topics, mutate, selectTopic, demo, setDemo } = useAppState();
  const synthetic = topics.filter((topic) => topic.name.endsWith(syntheticSuffix));

  function loadSynthetic() {
    const jiang = findItem("zuming-jiang");
    const song = findItem("zhuoran-song");
    const mpi = findItem("mpi-internship");
    if (!jiang?.candidate || !song?.candidate || !mpi) return;
    const mpiTarget = toSaveTarget(mpi);
    let firstId = "";
    const ok = mutate((store) => {
      const summer = store.createTopic({
        name: `暑期研究${syntheticSuffix}`,
        question: "暑假想先短期参与 AI 系统方向的研究，哪条途径更清楚？",
        preferences: "（合成示例）暑期 8 周左右；有 C++ 和一点 CUDA 基础",
      });
      firstId = summer.id;
      store.updateTopic(summer.id, { types: ["research", "exchange"] });
      store.saveCandidate(
        summer.id,
        jiang.candidate as NonNullable<typeof jiang.candidate>,
        {
          reason:
            "（合成示例）主页写了 RA 机会，成员页也有访问学生，适合先问短期参与。",
          questions: ["（合成示例）RA 是否接收本科生？"],
        },
      );
      store.saveCandidate(
        summer.id,
        song.candidate as NonNullable<typeof song.candidate>,
        {
          reason: "（合成示例）GPU 和模型加速方向和我的兴趣更近。",
          questions: [],
        },
      );
      if (mpiTarget.kind === "opportunity") {
        store.saveOpportunity(summer.id, mpiTarget.snapshot, {
          reason: "（合成示例）想对比一个海外暑期项目。",
          questions: [],
        });
      }
      store.setDecision(summer.id, { kind: "candidate", id: "zuming-jiang" }, "keep");
      store.setDecision(summer.id, { kind: "candidate", id: "zhuoran-song" }, "maybe");
      const longTerm = store.createTopic({
        name: `长期导师探索${syntheticSuffix}`,
        question: "长期读研时，哪位老师的研究问题更适合我？",
        preferences: "（合成示例）先看研究问题，不急着联系",
      });
      store.updateTopic(longTerm.id, { types: ["research", "graduate"] });
      store.saveCandidate(
        longTerm.id,
        jiang.candidate as NonNullable<typeof jiang.candidate>,
        {
          reason: "（合成示例）数据库和形式验证的研究问题有意思，但还要看具体课题。",
          questions: ["（合成示例）目标年度博士申请的截止时间？"],
        },
      );
    }, "已载入两个合成示例主题；名称都带“（合成示例）”，理由是编写的演示内容。");
    if (ok && firstId) selectTopic(firstId);
  }

  function clearSynthetic() {
    mutate((store) => {
      for (const topic of synthetic) store.deleteTopic(topic.id);
    }, "已删除合成示例主题；其他主题不受影响。");
    selectTopic("", { remember: false });
  }

  return (
    <Stack gap="spacious">
      <Stack gap="condensed">
        <Heading as="h1">演示路线</Heading>
        <Text as="p">
          中期演示按下面的顺序走一遍“探索 → 发现 →
          处理”。每一步都标明是实时读取、已有资料、本地操作、模拟服务还是回放。
        </Text>
        <Banner
          variant="info"
          layout="compact"
          title="这里的开关只影响演示"
          description="不会改动公开资料；合成示例主题的名称都带“（合成示例）”，可以一键清除。"
        />
      </Stack>

      <Stack as="section" gap="normal" aria-labelledby="demo-data">
        <Heading as="h2" variant="medium" id="demo-data">
          演示数据与模拟设置
        </Heading>
        <Stack direction="horizontal" gap="condensed" wrap="wrap" align="center">
          <Button onClick={loadSynthetic} disabled={synthetic.length > 0}>
            载入两个合成示例主题
          </Button>
          <Button
            variant="danger"
            onClick={clearSynthetic}
            disabled={synthetic.length === 0}
          >
            清除合成示例主题（{synthetic.length}）
          </Button>
        </Stack>
        <Stack direction={{ narrow: "vertical", regular: "horizontal" }} gap="spacious">
          <RadioGroup name="analysis-outcome">
            <RadioGroup.Label>AI 整理（模拟服务）的结果</RadioGroup.Label>
            {outcomes.map((outcome) => (
              <FormControl key={outcome.id}>
                <Radio
                  value={outcome.id}
                  checked={demo.analysisOutcome === outcome.id}
                  onChange={() => setDemo({ analysisOutcome: outcome.id })}
                />
                <FormControl.Label>{outcome.label}</FormControl.Label>
                <FormControl.Caption>{outcome.note}</FormControl.Caption>
              </FormControl>
            ))}
          </RadioGroup>
          <RadioGroup name="discovery-replay">
            <RadioGroup.Label>联网查找的方式</RadioGroup.Label>
            <FormControl>
              <Radio
                value="live"
                checked={demo.replay === null}
                onChange={() => setDemo({ replay: null })}
              />
              <FormControl.Label>实时（默认）</FormControl.Label>
              <FormControl.Caption>
                访问本地 API，再由它读取公开网页
              </FormControl.Caption>
            </FormControl>
            {replayScenarios.map((scenario) => (
              <FormControl key={scenario.id}>
                <Radio
                  value={scenario.id}
                  checked={demo.replay === scenario.id}
                  onChange={() => setDemo({ replay: scenario.id as ReplayScenario })}
                />
                <FormControl.Label>演示回放：{scenario.label}</FormControl.Label>
                <FormControl.Caption>{scenario.note}</FormControl.Caption>
              </FormControl>
            ))}
          </RadioGroup>
        </Stack>
      </Stack>

      <Stack as="section" gap="normal" aria-labelledby="demo-steps">
        <Heading as="h2" variant="medium" id="demo-steps">
          步骤
        </Heading>
        <Stack as="ol" gap="normal" aria-labelledby="demo-steps">
          {steps.map((step, index) => (
            <Stack as="li" key={step.title} gap="condensed">
              <Text weight="semibold">
                {index + 1}. {step.title}
              </Text>
              <Text>{step.expect}</Text>
              <Stack direction="horizontal" gap="condensed" wrap="wrap" align="center">
                {step.modes.map((mode) => (
                  <Label key={mode} variant={modeVariant[mode]}>
                    {mode}
                  </Label>
                ))}
                {step.route && <Link href={routeHref(step.route)}>前往这一步</Link>}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
