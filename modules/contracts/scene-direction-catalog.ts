import {
  sceneDirectionCatalogV1Hash,
  sceneDirectionCatalogV1Schema,
  type SceneDirectionCatalogV1,
} from "./scene-direction-contract.js";

const semantic = {
  catalogId: "catalog:scene-direction:v1",
  version: 1 as const,
  aspect: "LANDSCAPE_16_9" as const,
  theme: "TECH_HUD_DARK_V1" as const,
  informationRelations: [
    {
      relationId: "SINGLE_CLAIM" as const,
      label: "单点主张",
      designQuestion: "这一段需要观众只记住哪一个中心结论？",
      compatibleLayoutFamilyIds: ["F01_PERSON_DELIVERY", "F02_TEXT_TAKEOVER", "F09_SCREEN_OPERATION", "F10_EVIDENCE_TAKEOVER"],
      signatureGroupKinds: ["SOURCE_CARRIER", "HEADLINE", "KEY_TEXT", "CALLOUT"],
    },
    {
      relationId: "DEFINITION_BREAKDOWN" as const,
      label: "定义与拆解",
      designQuestion: "一个概念由哪些必要部分构成，它们怎样解释整体？",
      compatibleLayoutFamilyIds: ["F01_PERSON_DELIVERY", "F02_TEXT_TAKEOVER", "F04_PARALLEL_COMPONENTS", "F07_LIST", "F11_STEP_SEQUENCE"],
      signatureGroupKinds: ["CARD_SET", "LIST", "FLOW"],
    },
    {
      relationId: "PARALLEL_GROUPING" as const,
      label: "并列与归类",
      designQuestion: "哪些信息处于同一层级，应该同时比较或归入同一组？",
      compatibleLayoutFamilyIds: ["F04_PARALLEL_COMPONENTS", "F07_LIST", "F02_TEXT_TAKEOVER"],
      signatureGroupKinds: ["CARD_SET", "LIST"],
    },
    {
      relationId: "SEQUENCE_PROCESS" as const,
      label: "顺序与流程",
      designQuestion: "观众必须按什么先后顺序理解动作、步骤或因果链？",
      compatibleLayoutFamilyIds: ["F05_TIME_PROCESS", "F09_SCREEN_OPERATION", "F11_STEP_SEQUENCE", "F07_LIST"],
      signatureGroupKinds: ["FLOW", "TIMELINE", "LIST"],
    },
    {
      relationId: "COMPARISON_CHANGE" as const,
      label: "对比与变化",
      designQuestion: "哪两个状态需要并置，变化方向和关键差异是什么？",
      compatibleLayoutFamilyIds: ["F03_DATA_PROOF", "F06_COMPARISON", "F09_SCREEN_OPERATION", "F10_EVIDENCE_TAKEOVER"],
      signatureGroupKinds: ["COMPARISON", "FLOW", "METRIC"],
    },
    {
      relationId: "DATA_PROOF" as const,
      label: "数据与证明",
      designQuestion: "哪条数据或证据直接支撑这一段的主张？",
      compatibleLayoutFamilyIds: ["F03_DATA_PROOF", "F06_COMPARISON", "F10_EVIDENCE_TAKEOVER"],
      signatureGroupKinds: ["METRIC", "COMPARISON", "CARD_SET"],
    },
    {
      relationId: "TIME_POSITION" as const,
      label: "时间与定位",
      designQuestion: "信息位于什么时间、阶段或坐标位置，观众要如何定位它？",
      compatibleLayoutFamilyIds: ["F05_TIME_PROCESS", "F03_DATA_PROOF", "F11_STEP_SEQUENCE"],
      signatureGroupKinds: ["TIMELINE", "METRIC"],
    },
    {
      relationId: "PROBLEM_SOLUTION_VERIFICATION" as const,
      label: "问题、解决与验证",
      designQuestion: "问题、解决动作和验证结果怎样形成一条完整闭环？",
      compatibleLayoutFamilyIds: ["F06_COMPARISON", "F08_RISK_QA", "F09_SCREEN_OPERATION", "F10_EVIDENCE_TAKEOVER", "F11_STEP_SEQUENCE"],
      signatureGroupKinds: ["FLOW", "COMPARISON", "RISK_MATRIX", "CARD_SET"],
    },
  ],
  groupKinds: [
    { groupKind: "SOURCE_CARRIER" as const, label: "真实来源载体", purpose: "承载人物、录屏、实拍或证据素材；不直接改造素材内容。", minimumItems: 0, maximumItems: 0, semantic: false, derivedWithoutOwnerAllowed: false, allowedPackagingPolicies: ["SOURCE_CLEAN", "CONTAINER_FOCUS_ONLY"] as const },
    { groupKind: "HEADLINE" as const, label: "中心标题", purpose: "以一条可核对文字承担单点结论或段落中心命题。", minimumItems: 1, maximumItems: 2, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "KEY_TEXT" as const, label: "重点文字", purpose: "补充、强调或定位主视觉正在传递的关键信息。", minimumItems: 1, maximumItems: 4, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "METRIC" as const, label: "指标数字", purpose: "用数字、单位和必要标签呈现可核对的数据证据。", minimumItems: 1, maximumItems: 4, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "CARD_SET" as const, label: "信息卡组", purpose: "将同层级定义、分类、证据或步骤组织成有限卡片集合。", minimumItems: 2, maximumItems: 8, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "FLOW" as const, label: "流程链", purpose: "呈现有方向的步骤、因果、问题到解决或旧到新的路径。", minimumItems: 2, maximumItems: 10, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "TIMELINE" as const, label: "时间轴", purpose: "呈现时间、阶段、位置、关键点或可恢复的进度。", minimumItems: 2, maximumItems: 10, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "COMPARISON" as const, label: "对比组", purpose: "并置两个状态、路径或结果并明确差异方向。", minimumItems: 2, maximumItems: 4, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "LIST" as const, label: "有序或并列列表", purpose: "在不需要复杂拓扑时清晰呈现有限条目。", minimumItems: 2, maximumItems: 8, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "RISK_MATRIX" as const, label: "风险验证矩阵", purpose: "将风险、控制、验证或 QA 关系组织成可扫描结构。", minimumItems: 3, maximumItems: 12, semantic: true, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "CALLOUT" as const, label: "标注与提示", purpose: "把支持文字、定位信息或证据指向主视觉中的具体对象。", minimumItems: 1, maximumItems: 4, semantic: true, derivedWithoutOwnerAllowed: false, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const },
    { groupKind: "HIGHLIGHT" as const, label: "聚焦高亮", purpose: "只负责引导注意，不新增事实、标签或主张。", minimumItems: 0, maximumItems: 0, semantic: false, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["DESIGNED_MOTION", "CONTAINER_FOCUS_ONLY"] as const },
    { groupKind: "CONNECTOR_SET" as const, label: "结构连接", purpose: "连接已有信息组，表达已被证据支持的方向或层级。", minimumItems: 0, maximumItems: 0, semantic: false, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["STATIC_SCAFFOLD", "DESIGNED_MOTION"] as const },
    { groupKind: "BACKGROUND_SCAFFOLD" as const, label: "背景骨架", purpose: "提供网格、分区或安全区骨架，不独立争夺注意力。", minimumItems: 0, maximumItems: 0, semantic: false, derivedWithoutOwnerAllowed: true, allowedPackagingPolicies: ["STATIC_SCAFFOLD"] as const },
  ],
  objectPolicies: [
    { visualObjectKind: "PERSON" as const, sourceBearing: true, allowedPackagingPolicies: ["SOURCE_CLEAN", "CONTAINER_FOCUS_ONLY"] as const, requiredGroupKinds: ["SOURCE_CARRIER"] as const },
    { visualObjectKind: "SCREEN_RECORDING" as const, sourceBearing: true, allowedPackagingPolicies: ["SOURCE_CLEAN", "CONTAINER_FOCUS_ONLY"] as const, requiredGroupKinds: ["SOURCE_CARRIER"] as const },
    { visualObjectKind: "LIVE_DEMONSTRATION" as const, sourceBearing: true, allowedPackagingPolicies: ["SOURCE_CLEAN", "CONTAINER_FOCUS_ONLY"] as const, requiredGroupKinds: ["SOURCE_CARRIER"] as const },
    { visualObjectKind: "EVIDENCE_MEDIA" as const, sourceBearing: true, allowedPackagingPolicies: ["SOURCE_CLEAN", "CONTAINER_FOCUS_ONLY"] as const, requiredGroupKinds: ["SOURCE_CARRIER"] as const },
    { visualObjectKind: "STRUCTURED_EXPLANATION" as const, sourceBearing: false, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const, requiredGroupKinds: ["CARD_SET", "FLOW", "TIMELINE", "COMPARISON", "LIST", "RISK_MATRIX"] as const },
    { visualObjectKind: "TEXT_COMPOSITION" as const, sourceBearing: false, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const, requiredGroupKinds: ["HEADLINE", "KEY_TEXT", "METRIC", "CARD_SET", "COMPARISON", "LIST"] as const },
    { visualObjectKind: "KEY_TEXT" as const, sourceBearing: false, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const, requiredGroupKinds: ["HEADLINE", "KEY_TEXT", "METRIC"] as const },
    { visualObjectKind: "PERSON_PIP" as const, sourceBearing: true, allowedPackagingPolicies: ["SOURCE_CLEAN", "CONTAINER_FOCUS_ONLY"] as const, requiredGroupKinds: ["SOURCE_CARRIER"] as const },
    { visualObjectKind: "DETAIL_VIEW" as const, sourceBearing: true, allowedPackagingPolicies: ["SOURCE_CLEAN", "CONTAINER_FOCUS_ONLY"] as const, requiredGroupKinds: ["SOURCE_CARRIER"] as const },
    { visualObjectKind: "ANNOTATION" as const, sourceBearing: false, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const, requiredGroupKinds: ["CALLOUT", "HIGHLIGHT"] as const },
    { visualObjectKind: "CONTEXT_LABEL" as const, sourceBearing: false, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const, requiredGroupKinds: ["KEY_TEXT", "CALLOUT"] as const },
    { visualObjectKind: "MINI_EXPLANATION" as const, sourceBearing: false, allowedPackagingPolicies: ["DESIGNED_MOTION"] as const, requiredGroupKinds: ["CARD_SET", "FLOW", "TIMELINE", "COMPARISON", "LIST"] as const },
    { visualObjectKind: "DECORATIVE_ACCENT" as const, sourceBearing: false, allowedPackagingPolicies: ["DESIGNED_MOTION", "STATIC_SCAFFOLD"] as const, requiredGroupKinds: ["HIGHLIGHT", "CONNECTOR_SET", "BACKGROUND_SCAFFOLD"] as const },
  ],
  operations: [
    { operation: "ADD" as const, label: "增加", purpose: "在语义锚点出现新的对象组并建立当前状态。", allowedMotionReasons: ["ESTABLISH", "REVEAL", "SHOW_RELATION"] as const },
    { operation: "REPLACE" as const, label: "替换", purpose: "移除当前对象组并以新对象组承担下一状态的信息。", allowedMotionReasons: ["MARK_PROGRESS", "COMPARE", "SHOW_RELATION"] as const },
    { operation: "TRANSFORM" as const, label: "变形", purpose: "让一个已出现的设计对象在语义上变成另一个设计对象。", allowedMotionReasons: ["MARK_PROGRESS", "COMPARE", "SHOW_RELATION", "VERIFY"] as const },
    { operation: "FOCUS" as const, label: "聚焦", purpose: "不改变信息集合，只把唯一注意中心移到已出现对象。", allowedMotionReasons: ["DIRECT_ATTENTION", "VERIFY"] as const },
    { operation: "CONCLUDE" as const, label: "收束", purpose: "在段尾把注意力收回到唯一结论对象，形成稳定结束状态。", allowedMotionReasons: ["CONCLUDE"] as const },
  ],
  invariantCodes: [
    "ONE_INFORMATION_RELATION_PER_PARAGRAPH",
    "LAYOUT_RELATION_COMPATIBLE",
    "EVERY_UPSTREAM_OBJECT_REPRESENTED",
    "REAL_SOURCE_CONTENT_UNMODIFIED",
    "SEMANTIC_GRAPHICS_EVIDENCE_BOUND",
    "NO_ZERO_PACKAGING_FOR_DESIGNED_OBJECT",
    "FIRST_STATE_ADD",
    "LAST_STATE_CONCLUDE",
    "STRICTLY_INCREASING_WORD_ANCHORS",
    "ONE_FOCUS_CENTER_PER_STATE",
    "EVERY_GROUP_APPEARS",
    "HOST_DERIVES_FRAMES_AND_GEOMETRY",
    "NO_COMPONENT_IDS_IN_DESIGN_PLAN",
  ],
};

export const SCENE_DIRECTION_CATALOG_V1: SceneDirectionCatalogV1 = sceneDirectionCatalogV1Schema.parse({
  schemaVersion: 1,
  ...semantic,
  catalogHash: sceneDirectionCatalogV1Hash(semantic),
});

export function sceneRelationCatalogItem(relationId: SceneDirectionCatalogV1["informationRelations"][number]["relationId"]) {
  return SCENE_DIRECTION_CATALOG_V1.informationRelations.find((item) => item.relationId === relationId)!;
}

export function sceneGroupCatalogItem(groupKind: SceneDirectionCatalogV1["groupKinds"][number]["groupKind"]) {
  return SCENE_DIRECTION_CATALOG_V1.groupKinds.find((item) => item.groupKind === groupKind)!;
}

export function sceneObjectPolicyCatalogItem(kind: SceneDirectionCatalogV1["objectPolicies"][number]["visualObjectKind"]) {
  return SCENE_DIRECTION_CATALOG_V1.objectPolicies.find((item) => item.visualObjectKind === kind)!;
}

export function sceneOperationCatalogItem(operation: SceneDirectionCatalogV1["operations"][number]["operation"]) {
  return SCENE_DIRECTION_CATALOG_V1.operations.find((item) => item.operation === operation)!;
}
