import {
  layoutCatalogV1Hash,
  layoutCatalogV1Schema,
  type LayoutCatalogV1,
  type LayoutCatalogVariantV1,
  type LayoutFoundationParagraphV1,
} from "./layout-contract.js";

const FAILURE_CODES = [
  "LAYOUT_MAIN_OBJECT_MISSING",
  "LAYOUT_SUPPORT_OBJECT_MISSING",
  "LAYOUT_OBJECT_STALE",
  "LAYOUT_OBJECT_KIND_INCOMPATIBLE",
] as const;

const ALL_SUPPORT_KINDS = [
  "KEY_TEXT",
  "PERSON_PIP",
  "DETAIL_VIEW",
  "ANNOTATION",
  "CONTEXT_LABEL",
  "MINI_EXPLANATION",
  "DECORATIVE_ACCENT",
] as const;

type Frame = { xPermille: number; yPermille: number; widthPermille: number; heightPermille: number };

interface VariantInput {
  variantId: LayoutCatalogVariantV1["variantId"];
  familyId: LayoutCatalogVariantV1["familyId"];
  familyLabel: string;
  variantLabel: string;
  purpose: string;
  allowedMainKinds: LayoutCatalogVariantV1["allowedMainKinds"];
  allowedSupportingKinds?: LayoutCatalogVariantV1["allowedSupportingKinds"];
  maximumSupports?: 1 | 2;
  mainFrame: Frame;
  primaryFrame: Frame;
  secondaryFrame?: Frame;
  mainArea: [number, number];
  primaryArea: [number, number];
  secondaryArea?: [number, number];
  supportOverlap?: "NONE" | "OVER_MAIN" | "INSET_IN_MAIN";
  supportPersonTreatment?: "NONE" | "RECTANGULAR_PIP" | "CIRCULAR_PIP";
  mainPersonTreatment?: "NONE" | "FULL_FRAME";
  mainTextCapacity?: { maximumGraphemes: number; maximumLines: number; maximumItems: number } | null;
  supportTextCapacity?: { maximumGraphemes: number; maximumLines: number; maximumItems: number } | null;
}

function variant(input: VariantInput): LayoutCatalogVariantV1 {
  const supportingKinds = input.allowedSupportingKinds ?? [...ALL_SUPPORT_KINDS];
  const maximumSupports = input.maximumSupports ?? 2;
  const supportCapacity = input.supportTextCapacity ?? {
    maximumGraphemes: 72,
    maximumLines: 4,
    maximumItems: 3,
  };
  const slots: LayoutCatalogVariantV1["slots"] = [
    {
      slotId: "MAIN_STAGE",
      role: "MAIN",
      required: true,
      acceptedKinds: [...input.allowedMainKinds],
      acceptedStrengths: [],
      frameToken: input.mainFrame,
      areaSharePermille: { minimum: input.mainArea[0], maximum: input.mainArea[1] },
      zIndex: 10,
      alignment: "FILL",
      overlapPolicy: "NONE",
      personTreatment: input.mainPersonTreatment ?? "NONE",
      textCapacity: input.mainTextCapacity ?? null,
    },
    {
      slotId: "SUPPORT_PRIMARY",
      role: "SUPPORTING",
      required: true,
      acceptedKinds: [...supportingKinds],
      acceptedStrengths: ["STRONG", "LIGHT"],
      frameToken: input.primaryFrame,
      areaSharePermille: { minimum: input.primaryArea[0], maximum: input.primaryArea[1] },
      zIndex: 30,
      alignment: "CENTER",
      overlapPolicy: input.supportOverlap ?? "OVER_MAIN",
      personTreatment: input.supportPersonTreatment ?? "RECTANGULAR_PIP",
      textCapacity: supportCapacity,
    },
  ];
  if (maximumSupports === 2) {
    slots.push({
      slotId: "SUPPORT_SECONDARY",
      role: "SUPPORTING",
      required: false,
      acceptedKinds: [...supportingKinds],
      acceptedStrengths: ["STRONG", "LIGHT"],
      frameToken: input.secondaryFrame ?? { xPermille: 700, yPermille: 90, widthPermille: 230, heightPermille: 160 },
      areaSharePermille: {
        minimum: input.secondaryArea?.[0] ?? 40,
        maximum: input.secondaryArea?.[1] ?? 150,
      },
      zIndex: 40,
      alignment: "CENTER",
      overlapPolicy: input.supportOverlap ?? "OVER_MAIN",
      personTreatment: input.supportPersonTreatment ?? "RECTANGULAR_PIP",
      textCapacity: supportCapacity,
    });
  }
  return {
    variantId: input.variantId,
    familyId: input.familyId,
    familyLabel: input.familyLabel,
    variantLabel: input.variantLabel,
    purpose: input.purpose,
    aspect: "LANDSCAPE_16_9",
    minimumCanvas: { width: 1280, height: 720 },
    allowedMainKinds: [...input.allowedMainKinds],
    allowedSupportingKinds: [...supportingKinds],
    supportCount: { minimum: 1, maximum: maximumSupports },
    maximumStrongSupportingCount: 1,
    slots,
    hierarchyPolicy: "MAIN_MUST_BE_LARGEST",
    safeRegion: { leftPermille: 50, rightPermille: 50, topPermille: 55, bottomPermille: 190 },
    captionPolicy: {
      ordinaryCaptionsAreSeparateLayer: true,
      minimumBottomClearancePermille: 180,
      supportingTextMayOverlapCaptionZone: false,
    },
    objectFailureCodes: [...FAILURE_CODES],
  };
}

const variants: LayoutCatalogVariantV1[] = [
  variant({
    variantId: "layout:v1:1a-person-information-rail",
    familyId: "F01_PERSON_DELIVERY",
    familyLabel: "人物讲述",
    variantLabel: "人物 + 信息栏",
    purpose: "人物保持主要信息承担者，副视觉以受控信息栏完成强调、说明或定位。",
    allowedMainKinds: ["PERSON"],
    allowedSupportingKinds: ["KEY_TEXT", "DETAIL_VIEW", "ANNOTATION", "CONTEXT_LABEL", "MINI_EXPLANATION", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 0, yPermille: 0, widthPermille: 1000, heightPermille: 1000 },
    primaryFrame: { xPermille: 600, yPermille: 100, widthPermille: 330, heightPermille: 520 },
    secondaryFrame: { xPermille: 70, yPermille: 90, widthPermille: 250, heightPermille: 140 },
    mainArea: [900, 1000],
    primaryArea: [120, 270],
    secondaryArea: [30, 110],
    supportOverlap: "OVER_MAIN",
    mainPersonTreatment: "FULL_FRAME",
    supportPersonTreatment: "NONE",
    supportTextCapacity: { maximumGraphemes: 96, maximumLines: 6, maximumItems: 3 },
  }),
  variant({
    variantId: "layout:v1:1b-clean-person",
    familyId: "F01_PERSON_DELIVERY",
    familyLabel: "人物讲述",
    variantLabel: "纯净人物",
    purpose: "人物全屏承担完整信息，只保留一个克制的文字、标签或装饰副视觉。",
    allowedMainKinds: ["PERSON"],
    allowedSupportingKinds: ["KEY_TEXT", "CONTEXT_LABEL", "DECORATIVE_ACCENT"],
    maximumSupports: 1,
    mainFrame: { xPermille: 0, yPermille: 0, widthPermille: 1000, heightPermille: 1000 },
    primaryFrame: { xPermille: 80, yPermille: 90, widthPermille: 360, heightPermille: 140 },
    mainArea: [900, 1000],
    primaryArea: [35, 110],
    supportOverlap: "OVER_MAIN",
    mainPersonTreatment: "FULL_FRAME",
    supportPersonTreatment: "NONE",
    supportTextCapacity: { maximumGraphemes: 48, maximumLines: 3, maximumItems: 2 },
  }),
  variant({
    variantId: "layout:v1:2-fullscreen-text",
    familyId: "F02_TEXT_TAKEOVER",
    familyLabel: "文字接管",
    variantLabel: "全屏文字接管",
    purpose: "文字构图成为最大信息主体，人物、语境标签或装饰只提供从属补充。",
    allowedMainKinds: ["TEXT_COMPOSITION"],
    allowedSupportingKinds: ["PERSON_PIP", "DETAIL_VIEW", "CONTEXT_LABEL", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 90, yPermille: 90, widthPermille: 820, heightPermille: 650 },
    primaryFrame: { xPermille: 735, yPermille: 90, widthPermille: 180, heightPermille: 180 },
    secondaryFrame: { xPermille: 90, yPermille: 620, widthPermille: 280, heightPermille: 100 },
    mainArea: [520, 760],
    primaryArea: [30, 120],
    secondaryArea: [25, 90],
    supportOverlap: "INSET_IN_MAIN",
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 140, maximumLines: 8, maximumItems: 6 },
  }),
  variant({
    variantId: "layout:v1:3a-single-data-proof",
    familyId: "F03_DATA_PROOF",
    familyLabel: "数据证明",
    variantLabel: "单数据证明",
    purpose: "以一个核心值或一组紧密相关证据值建立主视觉，副视觉解释来源与意义。",
    allowedMainKinds: ["STRUCTURED_EXPLANATION", "EVIDENCE_MEDIA"],
    allowedSupportingKinds: ["KEY_TEXT", "ANNOTATION", "CONTEXT_LABEL", "DETAIL_VIEW", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 120, yPermille: 100, widthPermille: 760, heightPermille: 560 },
    primaryFrame: { xPermille: 660, yPermille: 470, widthPermille: 260, heightPermille: 170 },
    secondaryFrame: { xPermille: 90, yPermille: 90, widthPermille: 250, heightPermille: 110 },
    mainArea: [400, 720],
    primaryArea: [40, 160],
    secondaryArea: [25, 90],
    mainTextCapacity: { maximumGraphemes: 120, maximumLines: 7, maximumItems: 4 },
  }),
  variant({
    variantId: "layout:v1:3b-before-after-data",
    familyId: "F03_DATA_PROOF",
    familyLabel: "数据证明",
    variantLabel: "前后数据对照",
    purpose: "主视觉承载两个受控状态或结果的对照，副视觉负责维度、结论或来源说明。",
    allowedMainKinds: ["STRUCTURED_EXPLANATION", "EVIDENCE_MEDIA"],
    allowedSupportingKinds: ["KEY_TEXT", "ANNOTATION", "CONTEXT_LABEL", "DETAIL_VIEW", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 80, yPermille: 90, widthPermille: 840, heightPermille: 570 },
    primaryFrame: { xPermille: 80, yPermille: 90, widthPermille: 220, heightPermille: 110 },
    secondaryFrame: { xPermille: 700, yPermille: 90, widthPermille: 220, heightPermille: 110 },
    mainArea: [450, 760],
    primaryArea: [20, 90],
    secondaryArea: [20, 90],
    mainTextCapacity: { maximumGraphemes: 150, maximumLines: 8, maximumItems: 6 },
  }),
  variant({
    variantId: "layout:v1:4-parallel-points",
    familyId: "F04_PARALLEL_COMPONENTS",
    familyLabel: "并列组件",
    variantLabel: "并列要点",
    purpose: "同一逻辑复合主视觉内并列展示有限要点，副视觉只补充上下文或强调。",
    allowedMainKinds: ["STRUCTURED_EXPLANATION", "TEXT_COMPOSITION"],
    allowedSupportingKinds: ["KEY_TEXT", "CONTEXT_LABEL", "PERSON_PIP", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 80, yPermille: 100, widthPermille: 840, heightPermille: 560 },
    primaryFrame: { xPermille: 730, yPermille: 90, widthPermille: 190, heightPermille: 170 },
    secondaryFrame: { xPermille: 80, yPermille: 90, widthPermille: 260, heightPermille: 100 },
    mainArea: [450, 730],
    primaryArea: [30, 120],
    secondaryArea: [25, 90],
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 180, maximumLines: 10, maximumItems: 5 },
  }),
  variant({
    variantId: "layout:v1:5a-timeline",
    familyId: "F05_TIME_PROCESS",
    familyLabel: "时间 / 流程",
    variantLabel: "时间线定位",
    purpose: "主视觉表达阶段、先后或当前位置，副视觉补充当前节点与语境。",
    allowedMainKinds: ["STRUCTURED_EXPLANATION", "TEXT_COMPOSITION"],
    allowedSupportingKinds: ["KEY_TEXT", "ANNOTATION", "CONTEXT_LABEL", "PERSON_PIP", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 80, yPermille: 130, widthPermille: 840, heightPermille: 470 },
    primaryFrame: { xPermille: 650, yPermille: 90, widthPermille: 270, heightPermille: 140 },
    secondaryFrame: { xPermille: 80, yPermille: 90, widthPermille: 240, heightPermille: 110 },
    mainArea: [380, 700],
    primaryArea: [35, 130],
    secondaryArea: [25, 90],
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 180, maximumLines: 9, maximumItems: 5 },
  }),
  variant({
    variantId: "layout:v1:5b-pipeline",
    familyId: "F05_TIME_PROCESS",
    familyLabel: "时间 / 流程",
    variantLabel: "流程管线",
    purpose: "主视觉承载二到五个有向步骤，副视觉强调当前动作、结果或约束。",
    allowedMainKinds: ["STRUCTURED_EXPLANATION", "LIVE_DEMONSTRATION"],
    allowedSupportingKinds: ["KEY_TEXT", "ANNOTATION", "CONTEXT_LABEL", "DETAIL_VIEW", "PERSON_PIP", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 70, yPermille: 100, widthPermille: 860, heightPermille: 540 },
    primaryFrame: { xPermille: 700, yPermille: 90, widthPermille: 230, heightPermille: 160 },
    secondaryFrame: { xPermille: 70, yPermille: 90, widthPermille: 250, heightPermille: 110 },
    mainArea: [440, 730],
    primaryArea: [35, 140],
    secondaryArea: [25, 95],
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 180, maximumLines: 9, maximumItems: 5 },
  }),
  variant({
    variantId: "layout:v1:6a-dual-object",
    familyId: "F06_COMPARISON",
    familyLabel: "比较",
    variantLabel: "双对象比较",
    purpose: "主视觉在统一维度中比较两个对象，副视觉标明维度、差异或结论。",
    allowedMainKinds: ["STRUCTURED_EXPLANATION", "EVIDENCE_MEDIA"],
    allowedSupportingKinds: ["KEY_TEXT", "ANNOTATION", "CONTEXT_LABEL", "DETAIL_VIEW", "PERSON_PIP", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 70, yPermille: 90, widthPermille: 860, heightPermille: 570 },
    primaryFrame: { xPermille: 720, yPermille: 90, widthPermille: 210, heightPermille: 150 },
    secondaryFrame: { xPermille: 70, yPermille: 90, widthPermille: 240, heightPermille: 110 },
    mainArea: [470, 760],
    primaryArea: [30, 120],
    secondaryArea: [25, 90],
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 170, maximumLines: 9, maximumItems: 6 },
  }),
  variant({
    variantId: "layout:v1:6b-dual-path",
    familyId: "F06_COMPARISON",
    familyLabel: "比较",
    variantLabel: "双路径比较",
    purpose: "主视觉并行表达两套路径、方法或结果，副视觉说明选择标准与结论。",
    allowedMainKinds: ["STRUCTURED_EXPLANATION", "TEXT_COMPOSITION"],
    allowedSupportingKinds: ["KEY_TEXT", "ANNOTATION", "CONTEXT_LABEL", "PERSON_PIP", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 70, yPermille: 90, widthPermille: 860, heightPermille: 570 },
    primaryFrame: { xPermille: 720, yPermille: 90, widthPermille: 210, heightPermille: 150 },
    secondaryFrame: { xPermille: 70, yPermille: 90, widthPermille: 240, heightPermille: 110 },
    mainArea: [470, 760],
    primaryArea: [30, 120],
    secondaryArea: [25, 90],
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 190, maximumLines: 10, maximumItems: 6 },
  }),
  variant({
    variantId: "layout:v1:7-fullscreen-list",
    familyId: "F07_LIST",
    familyLabel: "列表",
    variantLabel: "全屏列表",
    purpose: "主视觉承载受容量约束的有序或无序要点，副视觉提供标题、人物或轻量强调。",
    allowedMainKinds: ["TEXT_COMPOSITION", "STRUCTURED_EXPLANATION"],
    allowedSupportingKinds: ["KEY_TEXT", "CONTEXT_LABEL", "PERSON_PIP", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 100, yPermille: 90, widthPermille: 800, heightPermille: 590 },
    primaryFrame: { xPermille: 720, yPermille: 90, widthPermille: 180, heightPermille: 180 },
    secondaryFrame: { xPermille: 100, yPermille: 90, widthPermille: 260, heightPermille: 100 },
    mainArea: [450, 760],
    primaryArea: [30, 120],
    secondaryArea: [25, 90],
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 210, maximumLines: 12, maximumItems: 7 },
  }),
  variant({
    variantId: "layout:v1:8-risk-qa-loop",
    familyId: "F08_RISK_QA",
    familyLabel: "风险问答",
    variantLabel: "风险—问答闭环",
    purpose: "主视觉建立问题、风险与回应的闭环，副视觉强调结论、条件或人物语气。",
    allowedMainKinds: ["TEXT_COMPOSITION", "STRUCTURED_EXPLANATION", "PERSON"],
    allowedSupportingKinds: ["KEY_TEXT", "CONTEXT_LABEL", "PERSON_PIP", "DETAIL_VIEW", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 90, yPermille: 90, widthPermille: 820, heightPermille: 570 },
    primaryFrame: { xPermille: 700, yPermille: 90, widthPermille: 210, heightPermille: 180 },
    secondaryFrame: { xPermille: 90, yPermille: 90, widthPermille: 250, heightPermille: 110 },
    mainArea: [450, 760],
    primaryArea: [35, 130],
    secondaryArea: [25, 90],
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 180, maximumLines: 10, maximumItems: 5 },
  }),
  variant({
    variantId: "layout:v1:9-screen-operation",
    familyId: "F09_SCREEN_OPERATION",
    familyLabel: "操作演示",
    variantLabel: "屏幕操作演示",
    purpose: "录屏始终是最大主视觉，人物以圆形角标或文字以克制叠层完成解释。",
    allowedMainKinds: ["SCREEN_RECORDING"],
    allowedSupportingKinds: ["PERSON_PIP", "KEY_TEXT", "ANNOTATION", "DETAIL_VIEW", "CONTEXT_LABEL", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 40, yPermille: 50, widthPermille: 920, heightPermille: 700 },
    primaryFrame: { xPermille: 760, yPermille: 90, widthPermille: 170, heightPermille: 170 },
    secondaryFrame: { xPermille: 70, yPermille: 90, widthPermille: 290, heightPermille: 130 },
    mainArea: [620, 880],
    primaryArea: [25, 110],
    secondaryArea: [30, 110],
    supportOverlap: "INSET_IN_MAIN",
    supportPersonTreatment: "CIRCULAR_PIP",
    supportTextCapacity: { maximumGraphemes: 64, maximumLines: 4, maximumItems: 3 },
  }),
  variant({
    variantId: "layout:v1:10-evidence-takeover",
    familyId: "F10_EVIDENCE_TAKEOVER",
    familyLabel: "证据接管",
    variantLabel: "证据全屏接管",
    purpose: "证据媒体占据主要画面，来源、标注、人物或结论作为从属信息。",
    allowedMainKinds: ["EVIDENCE_MEDIA"],
    allowedSupportingKinds: ["KEY_TEXT", "PERSON_PIP", "DETAIL_VIEW", "ANNOTATION", "CONTEXT_LABEL", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 40, yPermille: 50, widthPermille: 920, heightPermille: 700 },
    primaryFrame: { xPermille: 760, yPermille: 90, widthPermille: 170, heightPermille: 170 },
    secondaryFrame: { xPermille: 70, yPermille: 90, widthPermille: 280, heightPermille: 120 },
    mainArea: [620, 880],
    primaryArea: [25, 110],
    secondaryArea: [30, 100],
    supportOverlap: "INSET_IN_MAIN",
    supportPersonTreatment: "CIRCULAR_PIP",
  }),
  variant({
    variantId: "layout:v1:11-step-sequence",
    familyId: "F11_STEP_SEQUENCE",
    familyLabel: "步骤序列",
    variantLabel: "步骤序列",
    purpose: "主视觉表达经确认的步骤顺序与当前步骤强调，副视觉补充动作、人物或注意事项。",
    allowedMainKinds: ["LIVE_DEMONSTRATION", "STRUCTURED_EXPLANATION", "TEXT_COMPOSITION"],
    allowedSupportingKinds: ["KEY_TEXT", "PERSON_PIP", "DETAIL_VIEW", "ANNOTATION", "CONTEXT_LABEL", "DECORATIVE_ACCENT"],
    mainFrame: { xPermille: 70, yPermille: 90, widthPermille: 860, heightPermille: 570 },
    primaryFrame: { xPermille: 710, yPermille: 90, widthPermille: 220, heightPermille: 170 },
    secondaryFrame: { xPermille: 70, yPermille: 90, widthPermille: 260, heightPermille: 110 },
    mainArea: [470, 760],
    primaryArea: [35, 130],
    secondaryArea: [25, 90],
    supportPersonTreatment: "CIRCULAR_PIP",
    mainTextCapacity: { maximumGraphemes: 190, maximumLines: 10, maximumItems: 6 },
  }),
];

// A MAIN-only choice is explicit. Existing variants retain their original contract.
variants.push(...variants.map(original=>({
  ...original,
  variantId:`${original.variantId}-solo` as LayoutCatalogVariantV1["variantId"],
  variantLabel:`${original.familyLabel} · 单主视觉`,
  purpose:"信息由一个主视觉完整承担，不强制添加辅助对象。",
  supportCount:{minimum:0,maximum:0},maximumStrongSupportingCount:0,
  slots:original.slots.filter(slot=>slot.role==="MAIN").map(slot=>({...slot,
    frameToken:slot.personTreatment==="FULL_FRAME"?{xPermille:0,yPermille:0,widthPermille:1000,heightPermille:1000}:{xPermille:60,yPermille:60,widthPermille:880,heightPermille:720},
    areaSharePermille:{minimum:500,maximum:1000},
  })),
})));

const catalogSemantic = {
  catalogId: "catalog:smart-packaging-layout-v1",
  version: 1 as const,
  aspect: "LANDSCAPE_16_9" as const,
  variants,
};

export const LAYOUT_CATALOG_V1: LayoutCatalogV1 = Object.freeze(layoutCatalogV1Schema.parse({
  schemaVersion: 1,
  ...catalogSemantic,
  catalogHash: layoutCatalogV1Hash(catalogSemantic),
}));

function roleObjects(paragraph: LayoutFoundationParagraphV1) {
  return {
    main: paragraph.objects.find((object) => object.role === "MAIN") ?? null,
    supporting: paragraph.objects.filter((object) => object.role === "SUPPORTING"),
  };
}

function supportingAssignmentExists(
  objects: LayoutFoundationParagraphV1["objects"],
  slots: LayoutCatalogVariantV1["slots"],
): boolean {
  const supporting = objects.filter((object) => object.role === "SUPPORTING");
  const supportSlots = slots.filter((slot) => slot.role === "SUPPORTING");
  const visit = (index: number, used: Set<string>): boolean => {
    if (index >= supporting.length) return true;
    const object = supporting[index]!;
    return supportSlots.some((slot) => {
      if (used.has(slot.slotId) || !slot.acceptedKinds.includes(object.kind)
        || object.strength === null || !slot.acceptedStrengths.includes(object.strength)) return false;
      used.add(slot.slotId);
      const result = visit(index + 1, used);
      used.delete(slot.slotId);
      return result;
    });
  };
  return visit(0, new Set());
}

export function layoutVariantCompatibilityReason(
  variantValue: LayoutCatalogVariantV1,
  paragraph: LayoutFoundationParagraphV1,
  canvas: { width: number; height: number },
): string | null {
  const aspect = canvas.width / canvas.height;
  if (canvas.width < variantValue.minimumCanvas.width || canvas.height < variantValue.minimumCanvas.height) {
    return "LAYOUT_CANVAS_TOO_SMALL";
  }
  if (Math.abs(aspect - (16 / 9)) > 0.02) return "LAYOUT_ASPECT_UNSUPPORTED";
  const { main, supporting } = roleObjects(paragraph);
  if (main === null) return "LAYOUT_MAIN_OBJECT_MISSING";
  if (!variantValue.allowedMainKinds.includes(main.kind as never)) return "LAYOUT_MAIN_KIND_INCOMPATIBLE";
  if (supporting.length < variantValue.supportCount.minimum
    || supporting.length > variantValue.supportCount.maximum) return "LAYOUT_SUPPORT_COUNT_INCOMPATIBLE";
  if (supporting.some((object) => !variantValue.allowedSupportingKinds.includes(object.kind as never))) {
    return "LAYOUT_SUPPORT_KIND_INCOMPATIBLE";
  }
  if (supporting.filter((object) => object.strength === "STRONG").length > variantValue.maximumStrongSupportingCount) {
    return "LAYOUT_SUPPORT_STRENGTH_INCOMPATIBLE";
  }
  if (!supportingAssignmentExists(paragraph.objects, variantValue.slots)) return "LAYOUT_SLOT_ASSIGNMENT_IMPOSSIBLE";
  return null;
}

export function compatibleLayoutVariants(
  paragraph: LayoutFoundationParagraphV1,
  canvas: { width: number; height: number },
): LayoutCatalogVariantV1[] {
  return LAYOUT_CATALOG_V1.variants.filter((candidate) =>
    layoutVariantCompatibilityReason(candidate, paragraph, canvas) === null);
}

export function layoutVariantById(variantId: string): LayoutCatalogVariantV1 | null {
  return LAYOUT_CATALOG_V1.variants.find((variantValue) => variantValue.variantId === variantId) ?? null;
}

export function layoutObjectKindIsTextBearing(
  kind: LayoutFoundationParagraphV1["objects"][number]["kind"],
): boolean {
  return ["TEXT_COMPOSITION", "KEY_TEXT", "ANNOTATION", "CONTEXT_LABEL", "MINI_EXPLANATION"].includes(kind);
}
