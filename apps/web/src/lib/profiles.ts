import { advisors } from "./advisors";

export type RouteKind = "undergrad" | "short-term" | "graduate";
export type RouteStatus = "evidenced" | "historical" | "unknown" | "not-stated";
export type ConditionLevel = "required" | "preferred" | "suggested";

export interface BoundClaim {
  text: string;
  urls: string[];
}

export interface RouteCondition extends BoundClaim {
  level: ConditionLevel;
}

export interface ParticipationRoute {
  kind: RouteKind;
  label: string;
  status: RouteStatus;
  statusNote: BoundClaim;
  conditions: RouteCondition[];
  prerequisites?: BoundClaim;
}

export interface PrepItem {
  text: string;
  reason: string;
  origin: "source" | "curated";
  urls: string[];
  resourceIds?: string[];
}

export interface BeyondInfo {
  records: (BoundClaim & { role: string; period: string })[];
  gap: string;
  paths: BoundClaim[];
  askList: string[];
}

export interface CandidateProfile {
  candidateId: string;
  summary: BoundClaim;
  themes: BoundClaim[];
  methods?: BoundClaim;
  routes: ParticipationRoute[];
  beyond: BeyondInfo;
  preparation: PrepItem[];
  unknowns: BoundClaim[];
  conflicts: { topic: string; versions: BoundClaim[] }[];
  perspectiveNotes?: Partial<
    Record<"research" | "short-term" | "graduate", BoundClaim>
  >;
}

const urlsByCandidate = new Map(
  advisors.map((advisor) => [
    advisor.candidateId,
    new Set(advisor.sources.map((source) => source.url)),
  ]),
);

function sourceUrl(candidateId: string, url: string): string {
  if (!urlsByCandidate.get(candidateId)?.has(url)) {
    throw new Error(`Profile source is not attached to ${candidateId}: ${url}`);
  }
  return url;
}

const wang = sourceUrl("wang-xiang", "https://xiangwang1223.github.io/");
const xiong = sourceUrl("xiong-yingfei", "https://xiongyingfei.github.io/");
const tianqiMpk = sourceUrl(
  "tianqi-chen",
  "https://catalyst.cs.cmu.edu/projects/mpk.html",
);
const tianqiFaq = sourceUrl("tianqi-chen", "https://tqchen.com/faq");
const charles = sourceUrl("charles-zhang", "https://www.cse.ust.hk/~charlesz/");
const guPost = sourceUrl(
  "shangding-gu",
  "https://www.xiaohongshu.com/explore/6a7574850000000024024a50",
);
const guOfficial = sourceUrl(
  "shangding-gu",
  "https://www.cs.sjtu.edu.cn/jiaoshiml/gushangding.html",
);
const jiangPost = sourceUrl(
  "zuming-jiang",
  "https://www.xiaohongshu.com/explore/6a6ec878000000003302c3c2",
);
const jiangOfficial = sourceUrl(
  "zuming-jiang",
  "https://www.cs.hku.hk/people/academic-staff/jzuming",
);
const jiangHome = sourceUrl("zuming-jiang", "https://jzuming.github.io/");
const jiangLab = sourceUrl("zuming-jiang", "https://jzuming.github.io/lab.html");
const songPost = sourceUrl(
  "zhuoran-song",
  "https://www.xiaohongshu.com/explore/6aae08600000000026014ac1",
);
const songOfficial = sourceUrl(
  "zhuoran-song",
  "https://www.cs.sjtu.edu.cn/jiaoshiml/songzhuoran.html",
);
const songHome = sourceUrl("zhuoran-song", "https://songzhuoran.github.io/");

export const candidateProfiles: Readonly<Record<string, CandidateProfile>> = {
  "wang-xiang": {
    candidateId: "wang-xiang",
    summary: {
      text: "研究大模型知识编辑；现有样本以 AlphaEdit 如何修改错误知识并尽量保留原知识为切入点。",
      urls: [wang],
    },
    themes: [
      {
        text: "模型知识编辑与参数更新对原有知识的影响。",
        urls: [wang],
      },
    ],
    methods: {
      text: "AlphaEdit 通过约束参数更新方向来减少对原知识的干扰；共同作者关系不代表未来实际指导安排。",
      urls: [wang],
    },
    routes: [
      {
        kind: "undergrad",
        label: "本科科研／毕业设计",
        status: "evidenced",
        statusNote: {
          text: "个人公开介绍长期欢迎本科科研和毕业设计；这不是当前名额确认。",
          urls: [wang],
        },
        conditions: [],
      },
      {
        kind: "short-term",
        label: "短期科研",
        status: "not-stated",
        statusNote: {
          text: "现有来源未单列短期科研途径、期限或接收条件。",
          urls: [wang],
        },
        conditions: [],
      },
      {
        kind: "graduate",
        label: "硕博申请",
        status: "evidenced",
        statusNote: {
          text: "个人公开介绍有长期欢迎硕博申请的表述；目标年度项目与名额仍需确认。",
          urls: [wang],
        },
        conditions: [],
      },
    ],
    beyond: {
      records: [],
      gap: "暂无可核实的指导经历记录。",
      paths: [
        {
          text: "可从个人主页继续查看公开研究与作品；作品和成员信息不是指导体验证据，本档案不收集私人联系方式。",
          urls: [wang],
        },
      ],
      askList: [
        "目标年度是否有名额，分别对应哪种参与途径？",
        "本科或毕业设计可参与哪些具体课题，通常持续多久？",
        "课题通常由谁直接指导，进展反馈如何安排？",
        "现有学生如何描述日常工作与支持方式？",
      ],
    },
    preparation: [
      {
        text: "先读 AlphaEdit 的研究问题，记下你想追问的知识编辑取舍。",
        reason: "可先判断是否对模型知识更新及保留原知识的问题感兴趣，不必先复现项目。",
        origin: "curated",
        urls: [wang],
      },
      {
        text: "按本科科研、毕业设计或硕博申请明确自己要询问的途径。",
        reason: "公开介绍同时提到多条途径，但具体课题、时间与目标年度需要分别确认。",
        origin: "curated",
        urls: [wang],
      },
      {
        text: "需要动手验证知识编辑代码时，再核对可用算力与账号条件。",
        reason:
          "相关工作可能涉及模型计算；平台存在不代表个人已有权限，也不是继续了解的前提。",
        origin: "curated",
        urls: [wang],
        resourceIds: ["scc-ai-platform"],
      },
    ],
    unknowns: [
      {
        text: "当前名额、具体课题、实际指导方式和独立参与体验均未确认。",
        urls: [wang],
      },
    ],
    conflicts: [],
    perspectiveNotes: {
      research: {
        text: "可先判断自己是否想继续理解知识编辑如何避免破坏原知识。",
        urls: [wang],
      },
      "short-term": {
        text: "若想短期尝试，应先问是否有独立的短期途径、期限和实际指导人。",
        urls: [wang],
      },
      graduate: {
        text: "若考虑硕博申请，应核对目标年度项目、名额与可参与课题。",
        urls: [wang],
      },
    },
  },
  "xiong-yingfei": {
    candidateId: "xiong-yingfei",
    summary: {
      text: "研究软件与程序分析；现有样本以自然语言要求能否由代码满足为切入点。",
      urls: [xiong],
    },
    themes: [
      {
        text: "程序验证、代码行为与自然语言需求之间的对应。",
        urls: [xiong],
      },
    ],
    methods: {
      text: "HoarePrompt 让模型逐步描述程序状态再检查要求，借鉴程序验证思想；共同作者关系不指定实际指导人。",
      urls: [xiong],
    },
    routes: [
      {
        kind: "undergrad",
        label: "本科科研",
        status: "not-stated",
        statusNote: {
          text: "已读个人页资料未说明本科科研接收途径。",
          urls: [xiong],
        },
        conditions: [],
      },
      {
        kind: "short-term",
        label: "短期科研",
        status: "not-stated",
        statusNote: {
          text: "已读个人页资料未说明 RA、短访或其他短期安排。",
          urls: [xiong],
        },
        conditions: [],
      },
      {
        kind: "graduate",
        label: "研究生申请",
        status: "not-stated",
        statusNote: {
          text: "已读个人页资料未说明当期研究生招生途径或名额。",
          urls: [xiong],
        },
        conditions: [],
      },
    ],
    beyond: {
      records: [],
      gap: "暂无可核实的指导经历记录。",
      paths: [
        {
          text: "可从个人主页的近期工作继续查具体研究问题；公开作品不是指导体验证据，本档案不收集私人联系方式。",
          urls: [xiong],
        },
      ],
      askList: [
        "目前有哪些本科、短期或研究生参与途径？",
        "目标年度是否接收学生，适用什么院系流程？",
        "可参与的具体课题与预期基础是什么？",
        "课题由谁直接指导，日常反馈如何安排？",
      ],
    },
    preparation: [
      {
        text: "读一个 HoarePrompt 的程序状态例子，记录仍不清楚的判断步骤。",
        reason:
          "可用具体例子判断自己是否关心代码正确性与程序验证，而不是据论文主题推断招生。",
        origin: "curated",
        urls: [xiong],
      },
      {
        text: "先写下想了解的参与类型，再查询对应院系与本人公开说明。",
        reason:
          "现有来源没有给出当期招生或短期参与途径，不能把研究兴趣直接当成可申请结论。",
        origin: "curated",
        urls: [xiong],
      },
    ],
    unknowns: [
      {
        text: "当期资格、接收途径、名额、具体课题与实际指导体验未确认。",
        urls: [xiong],
      },
    ],
    conflicts: [],
    perspectiveNotes: {
      research: {
        text: "可先判断自己是否想追问程序状态如何帮助检查自然语言要求。",
        urls: [xiong],
      },
      "short-term": {
        text: "短期途径没有来源说明；如要继续，应先确认是否接收以及期限与课题。",
        urls: [xiong],
      },
      graduate: {
        text: "研究生途径没有来源说明；应先核对目标年度院系流程和个人接收情况。",
        urls: [xiong],
      },
    },
  },
  "tianqi-chen": {
    candidateId: "tianqi-chen",
    summary: {
      text: "研究机器学习系统；现有样本以多 GPU 推理中的计算与通信调度为切入点。",
      urls: [tianqiMpk],
    },
    themes: [
      {
        text: "模型推理效率、GPU 系统以及计算与通信的协同。",
        urls: [tianqiMpk],
      },
    ],
    methods: {
      text: "MPK 通过编译和运行时调度组织任务，涉及性能测量、任务安排与 GPU 系统。",
      urls: [tianqiMpk],
    },
    routes: [
      {
        kind: "undergrad",
        label: "本科／硕士项目参与",
        status: "evidenced",
        statusNote: {
          text: "FAQ 列出面向 CMU 本科生和硕士生的项目机会，不能直接套用于外校学生。",
          urls: [tianqiFaq],
        },
        conditions: [
          {
            level: "required",
            text: "该项说明限定 CMU 本科生或硕士生。",
            urls: [tianqiFaq],
          },
        ],
        prerequisites: {
          text: "外校学生是否有其他对应途径，现有来源未说明。",
          urls: [tianqiFaq],
        },
      },
      {
        kind: "short-term",
        label: "外校短期科研",
        status: "unknown",
        statusNote: {
          text: "FAQ 中的校内项目不能作为外校暑研入口；是否另有短期接收途径未知。",
          urls: [tianqiFaq],
        },
        conditions: [],
      },
      {
        kind: "graduate",
        label: "MLD／CSD 博士申请",
        status: "evidenced",
        statusNote: {
          text: "FAQ 指向 CMU SCS 的 MLD／CSD 博士项目，由项目流程审阅；当前名额与截止时间未在样本中确认。",
          urls: [tianqiFaq],
        },
        conditions: [
          {
            level: "required",
            text: "博士申请需通过 MLD 或 CSD 项目流程，而不是把个人联系当成录取。",
            urls: [tianqiFaq],
          },
        ],
      },
    ],
    beyond: {
      records: [],
      gap: "暂无可核实的指导经历记录。",
      paths: [
        {
          text: "可从 MPK 项目页和申请 FAQ 分别了解研究工作与公开申请路径；项目作品不是指导体验证据，本档案不收集私人联系方式。",
          urls: [tianqiMpk, tianqiFaq],
        },
      ],
      askList: [
        "目标年度 MLD／CSD 项目与个人研究组分别如何匹配？",
        "外校学生是否存在短期科研或访问途径？",
        "当前可参与的具体课题需要哪些系统基础？",
        "课题由谁直接指导，反馈与协作如何安排？",
      ],
    },
    preparation: [
      {
        text: "先读 MPK 的任务调度说明，区分自己更关心编译、运行时还是性能测量。",
        reason: "这能把宽泛的 AI 系统兴趣落到一个具体研究问题上。",
        origin: "curated",
        urls: [tianqiMpk],
      },
      {
        text: "按自己的身份核对 FAQ 中的校内项目或 MLD／CSD 博士路径。",
        reason: "不同身份对应不同参与方式，校内本科／硕士机会不能直接当作外校入口。",
        origin: "source",
        urls: [tianqiFaq],
      },
      {
        text: "需要动手时再核对 GPU 算力、账号审批和费用条件。",
        reason: "多 GPU 系统工作可能需要算力；平台入口不代表个人已有权限。",
        origin: "curated",
        urls: [tianqiMpk],
        resourceIds: ["scc-ai-platform", "scc-register"],
      },
    ],
    unknowns: [
      {
        text: "当前名额、目标年度截止时间、外校短期科研接收和实际指导方式未确认。",
        urls: [tianqiFaq],
      },
    ],
    conflicts: [],
    perspectiveNotes: {
      research: {
        text: "可先判断自己是否想理解多 GPU 推理中的计算、通信与调度。",
        urls: [tianqiMpk],
      },
      "short-term": {
        text: "外校短期接收仍未知；应先确认是否有对应途径，而不是套用 CMU 校内项目。",
        urls: [tianqiFaq],
      },
      graduate: {
        text: "若考虑博士，应先核对 MLD／CSD 的目标年度规则，再围绕具体系统问题准备材料。",
        urls: [tianqiFaq],
      },
    },
  },
  "charles-zhang": {
    candidateId: "charles-zhang",
    summary: {
      text: "研究大型软件中的程序依赖与缺陷分析；现有样本以值如何跨模块流动为切入点。",
      urls: [charles],
    },
    themes: [
      {
        text: "程序分析、软件缺陷，以及 LLVM IR 与 LLM agents 的结合。",
        urls: [charles],
      },
    ],
    methods: {
      text: "Clearblue 组织程序依赖分析；旧模型文档不能代替个人主页所列研究的全部范围。",
      urls: [charles],
    },
    routes: [
      {
        kind: "undergrad",
        label: "本科科研",
        status: "not-stated",
        statusNote: {
          text: "现有个人页资料未说明本科科研接收安排。",
          urls: [charles],
        },
        conditions: [],
      },
      {
        kind: "short-term",
        label: "短期访问",
        status: "unknown",
        statusNote: {
          text: "校级短访制度的存在不证明本人接收；现有个人页没有给出接收承诺。",
          urls: [charles],
        },
        conditions: [],
      },
      {
        kind: "graduate",
        label: "HKUST CSE 研究生申请",
        status: "unknown",
        statusNote: {
          text: "可查院系研究生入口，但院系途径不证明个人有名额；主页的研究科学家岗位不是硕博招生。",
          urls: [charles],
        },
        conditions: [],
      },
    ],
    beyond: {
      records: [],
      gap: "暂无可核实的指导经历记录；公开去向或师生关系也不能替代体验记录。",
      paths: [
        {
          text: "可从个人主页继续查看 Clearblue、近期研究与公开成员线索；名单和作品不是指导体验证据，本档案不收集私人联系方式。",
          urls: [charles],
        },
      ],
      askList: [
        "目标年度是否有研究生名额，需走什么项目流程？",
        "是否接收本科或短期访问，适用哪些资格与期限？",
        "可参与的具体课题更偏程序分析还是 LLM agents？",
        "课题由谁直接指导，日常反馈如何安排？",
      ],
    },
    preparation: [
      {
        text: "先用 Clearblue 的依赖分析问题判断自己是否关心代码行为与缺陷来源。",
        reason: "具体问题比把整组研究概括为 LLM agents 更能帮助判断兴趣。",
        origin: "curated",
        urls: [charles],
      },
      {
        text: "把研究生、研究科学家岗位与短期访问分别核对。",
        reason: "这些途径的对象和规则不同，个人主页上的岗位不能替代学位招生依据。",
        origin: "curated",
        urls: [charles],
      },
    ],
    unknowns: [
      {
        text: "个人名额、本科或短期接收、具体课题、日常指导与独立参与体验未确认。",
        urls: [charles],
      },
    ],
    conflicts: [],
    perspectiveNotes: {
      research: {
        text: "可先判断自己是否想追问大型软件中的值流、依赖与缺陷。",
        urls: [charles],
      },
      "short-term": {
        text: "短访制度不等于本人接收；应先确认教师同意、期限和课题。",
        urls: [charles],
      },
      graduate: {
        text: "若考虑研究生申请，应分开核对院系规则与个人目标年度名额。",
        urls: [charles],
      },
    },
  },
  "shangding-gu": {
    candidateId: "shangding-gu",
    summary: {
      text: "研究 AI Agent 安全、强化学习与具身智能；招生帖还列出安全评测、机器人学习、基础模型和多智能体课题。",
      urls: [guPost, guOfficial],
    },
    themes: [
      {
        text: "AI Agent 安全与安全评测。",
        urls: [guPost, guOfficial],
      },
      {
        text: "强化学习、机器人学习、具身智能与多智能体。",
        urls: [guPost],
      },
    ],
    routes: [
      {
        kind: "undergrad",
        label: "本科科研",
        status: "evidenced",
        statusNote: {
          text: "截至 2026-10-04 的招生帖文字欢迎本科生参与；这是一项意向，不是当前名额确认。",
          urls: [guPost],
        },
        conditions: [
          {
            level: "preferred",
            text: "帖子提到编程基础和研究兴趣，未说明为必须同时满足的硬性要求。",
            urls: [guPost],
          },
        ],
      },
      {
        kind: "short-term",
        label: "科研实习",
        status: "evidenced",
        statusNote: {
          text: "截至 2026-10-04 的招生帖表达科研实习接收意向；具体安排和剩余名额未确认。",
          urls: [guPost],
        },
        conditions: [
          {
            level: "preferred",
            text: "帖子提到编程基础和研究兴趣，具体门槛仍需询问。",
            urls: [guPost],
          },
        ],
      },
      {
        kind: "graduate",
        label: "2027 级硕博",
        status: "evidenced",
        statusNote: {
          text: "截至 2026-10-04 的帖子表达招收 2027 级硕博的意向，不代表已确认招生名额或录取资格。",
          urls: [guPost],
        },
        conditions: [
          {
            level: "preferred",
            text: "帖子提到编程基础和研究兴趣；目标项目的正式资格未在已读文字中说明。",
            urls: [guPost],
          },
        ],
      },
    ],
    beyond: {
      records: [],
      gap: "暂无可核实的指导经历记录。",
      paths: [
        {
          text: "学院名录可通往公开的 SAIL 实验室与研究线索；实验室页面或成员名单不是指导体验证据，本档案不收集私人联系方式。",
          urls: [guOfficial],
        },
      ],
      askList: [
        "2027 级硕博、本科科研和科研实习目前各有多少名额？",
        "不同途径可参与哪些具体课题，预计持续多久？",
        "编程基础和研究兴趣如何判断，是否还有正式资格要求？",
        "课题由谁直接指导，日常反馈如何安排？",
      ],
    },
    preparation: [
      {
        text: "从安全评测、机器人学习、基础模型或多智能体中选一个想进一步了解的课题。",
        reason: "招生帖覆盖多个方向，先选具体问题有助于避免只按宽泛标签判断。",
        origin: "curated",
        urls: [guPost],
      },
      {
        text: "整理一项能说明编程基础或研究兴趣的课程、项目或问题。",
        reason: "帖子提到编程基础和研究兴趣，但未把它们写成统一硬门槛。",
        origin: "curated",
        urls: [guPost],
      },
    ],
    unknowns: [
      {
        text: "当前名额、具体课题、实习安排、正式资格、账号归属与独立指导体验未确认。",
        urls: [guPost, guOfficial],
      },
      {
        text: "招生帖配图未逐张读取，已整理内容只覆盖当次读到的文字。",
        urls: [guPost],
      },
    ],
    conflicts: [],
    perspectiveNotes: {
      research: {
        text: "可先从 Agent 安全、机器人学习或基础模型中选一个具体课题继续查。",
        urls: [guPost, guOfficial],
      },
      "short-term": {
        text: "若考虑科研实习，应先确认接收身份、期限、课题和实际指导人。",
        urls: [guPost],
      },
      graduate: {
        text: "若考虑 2027 级硕博，应再核对正式项目资格与当前名额。",
        urls: [guPost],
      },
    },
  },
  "zuming-jiang": {
    candidateId: "zuming-jiang",
    summary: {
      text: "研究数据库、操作系统与安全、软件工程，以及 AI 与系统的交叉。",
      urls: [jiangOfficial],
    },
    themes: [
      {
        text: "系统可靠性、安全、数据库与软件工程。",
        urls: [jiangOfficial],
      },
      {
        text: "AI 与系统的交叉研究。",
        urls: [jiangOfficial],
      },
    ],
    methods: {
      text: "通过测试、形式验证与程序分析研究系统可靠性、安全与性能。",
      urls: [jiangOfficial],
    },
    routes: [
      {
        kind: "undergrad",
        label: "本科科研",
        status: "unknown",
        statusNote: {
          text: "成员页列有 RA／visiting students，但现有来源未确认是否接收当前身份的本科生。",
          urls: [jiangLab],
        },
        conditions: [],
      },
      {
        kind: "short-term",
        label: "RA／短期科研",
        status: "evidenced",
        statusNote: {
          text: "个人主页列出有资助的 RA 机会，成员页也列有 RA／visiting students；当前名额、身份和期限仍待确认。",
          urls: [jiangHome, jiangLab],
        },
        conditions: [
          {
            level: "suggested",
            text: "主页建议发送 CV 与研究兴趣或计划，未说明这是完整申请要求。",
            urls: [jiangHome],
          },
        ],
      },
      {
        kind: "graduate",
        label: "2027 级博士",
        status: "evidenced",
        statusNote: {
          text: "招生帖提出 2027 级博士意向，主页列有资助的 PhD 机会；这是截至采集日的意向，不是名额确认。",
          urls: [jiangPost, jiangHome],
        },
        conditions: [
          {
            level: "suggested",
            text: "主页建议发送 CV 与研究兴趣或计划；正式资格和截止时间需查项目规则。",
            urls: [jiangHome],
          },
        ],
      },
    ],
    beyond: {
      records: [],
      gap: "暂无可核实的指导经历记录；招生帖中的指导描述属于作者自述。",
      paths: [
        {
          text: "可沿 ATOMS 实验室成员页的公开研究入口了解组内工作；成员名单不是指导体验证据，本档案不收集私人联系方式。",
          urls: [jiangLab],
        },
      ],
      askList: [
        "目标年份博士和 RA 当前是否有名额？",
        "RA 是否接收当前身份的本科生或访问学生，期限如何？",
        "具体课题更偏数据库缺陷、系统安全还是 AI 与系统？",
        "课题由谁直接指导，反馈与协作如何安排？",
      ],
    },
    preparation: [
      {
        text: "准备 CV 与一段具体的研究兴趣或计划。",
        reason: "个人主页明确建议用这些材料开展沟通。",
        origin: "source",
        urls: [jiangHome],
      },
      {
        text: "从数据库、系统安全或程序分析中选一个具体工作继续读。",
        reason: "研究范围较宽，具体问题更适合判断兴趣，也不能由方向标签推断个人适配。",
        origin: "curated",
        urls: [jiangOfficial],
      },
      {
        text: "分别核对博士和 RA 的身份、期限、资助与正式流程。",
        reason: "主页列出两种机会，但当前名额、RA 条件和项目资格仍未知。",
        origin: "curated",
        urls: [jiangPost, jiangHome],
      },
    ],
    unknowns: [
      {
        text: "具体课题、当前名额、博士正式资格、RA 身份条件、期限与资助细节未知。",
        urls: [jiangPost, jiangHome],
      },
      {
        text: "招生帖第二张图片未读取，成员列表与作者自述不能证明实际指导体验。",
        urls: [jiangPost, jiangLab],
      },
    ],
    conflicts: [],
    perspectiveNotes: {
      research: {
        text: "如果想继续了解，可沿数据库、系统安全或程序分析选一项具体工作，看看研究问题是否有趣。",
        urls: [jiangOfficial],
      },
      "short-term": {
        text: "如果想先尝试，可先问 RA／短期科研是否接收当前身份、谁实际指导，以及可参与的课题与期限。",
        urls: [jiangHome, jiangLab],
      },
      graduate: {
        text: "如果准备进一步了解，可先核对目标年份的博士资格与截止时间，再围绕一个具体研究问题整理兴趣。",
        urls: [jiangPost, jiangHome],
      },
    },
  },
  "zhuoran-song": {
    candidateId: "zhuoran-song",
    summary: {
      text: "研究面向大模型与具身智能的智能计算系统，涉及 AI Infra、GPU／体系结构与软硬件协同优化。",
      urls: [songOfficial, songHome],
    },
    themes: [
      {
        text: "VLA／LLM 加速与智能计算系统。",
        urls: [songPost, songHome],
      },
      {
        text: "3D Gaussian Splatting、三维重建、AI 加速器与 GPU 体系结构。",
        urls: [songPost],
      },
    ],
    methods: {
      text: "可从 VLA／LLM 加速、三维重建和 GPU 体系结构等工作区分模型应用与系统优化。",
      urls: [songPost, songHome],
    },
    routes: [
      {
        kind: "undergrad",
        label: "本科科研",
        status: "not-stated",
        statusNote: {
          text: "已读招生图未提供明确的本科科研接收安排。",
          urls: [songPost],
        },
        conditions: [],
      },
      {
        kind: "short-term",
        label: "短期科研／RA",
        status: "not-stated",
        statusNote: {
          text: "已读招生图说明工程博士和硕士意向，未提供 RA 或短访安排。",
          urls: [songPost],
        },
        conditions: [],
      },
      {
        kind: "graduate",
        label: "2027 级工程博士／硕士联合培养",
        status: "evidenced",
        statusNote: {
          text: "招生图提出 2027 级工程博士／硕士的创芯学院联合培养意向；这是截至采集日的意向，不是确认名额。",
          urls: [songPost],
        },
        conditions: [
          {
            level: "preferred",
            text: "C/C++、Python、CUDA、Verilog、GPU 或相关系统基础是帖子列举的相关经验示例，不要求全部具备。",
            urls: [songPost],
          },
          {
            level: "suggested",
            text: "帖子建议提供简历、学习或项目经历和感兴趣方向。",
            urls: [songPost],
          },
        ],
      },
    ],
    beyond: {
      records: [],
      gap: "暂无可核实的指导经历记录。",
      paths: [
        {
          text: "可从个人主页的近期论文继续了解 VLA／LLM 加速和系统优化；论文列表不是指导体验证据，本档案不收集私人联系方式。",
          urls: [songHome],
        },
      ],
      askList: [
        "联合培养的招生单位、学位类别和适用资格分别是什么？",
        "2027 级当前是否有名额，正式流程和时间如何？",
        "是否接收本科科研、RA 或其他短期参与？",
        "课题由谁直接指导，日常反馈如何安排？",
      ],
    },
    preparation: [
      {
        text: "准备简历、相关学习或项目经历和一个感兴趣方向。",
        reason: "招生图明确建议用这些材料开展进一步沟通。",
        origin: "source",
        urls: [songPost],
      },
      {
        text: "从 VLA／LLM 加速、三维重建或 GPU 体系结构中选一项具体工作阅读。",
        reason: "可帮助区分自己更关注模型任务、系统优化还是体系结构。",
        origin: "curated",
        urls: [songPost, songHome],
      },
      {
        text: "按自己已有经历整理一项 C/C++、Python、CUDA、Verilog、GPU 或系统基础。",
        reason: "这些是来源列举的相关经验示例，不是必须全部具备的清单。",
        origin: "curated",
        urls: [songPost],
        resourceIds: ["scc-ai-platform"],
      },
    ],
    unknowns: [
      {
        text: "联合培养的学位类别、招生单位、资格、剩余名额与具体安排需按官方规则确认。",
        urls: [songPost],
      },
      {
        text: "本科或短期接收与独立指导体验没有来源依据。",
        urls: [songPost, songOfficial],
      },
    ],
    conflicts: [
      {
        topic: "职称",
        versions: [
          {
            text: "上海交大教师页标题字段写“副研究员”。",
            urls: [songOfficial],
          },
          {
            text: "同一教师页正文写“副教授／博士生导师”，个人主页也自称 Associate Professor。",
            urls: [songOfficial, songHome],
          },
        ],
      },
    ],
    perspectiveNotes: {
      research: {
        text: "如果想继续了解，可挑一项 VLA／LLM 加速工作，看看更吸引你的是模型任务、GPU 优化还是体系结构。",
        urls: [songHome],
      },
      "short-term": {
        text: "如果想先尝试，可先问是否接收本科科研／短期参与，以及实际指导人、期限和可参与课题。",
        urls: [songPost],
      },
      graduate: {
        text: "如果考虑这一途径，可先确认联合培养的招生单位、学位类别与资格，再按感兴趣方向说明相关学习／项目经历。",
        urls: [songPost],
      },
    },
  },
};

export function profileFor(candidateId: string): CandidateProfile | undefined {
  return candidateProfiles[candidateId];
}
