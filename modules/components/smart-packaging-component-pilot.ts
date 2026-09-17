import { canonicalHash } from "../shared/timeline-v2/canonical.js";
import type { VisualRoleObjectKind } from "./contracts.js";
import type {
  LayoutRealPreviewObjectV1,
  LayoutRealPreviewV1,
} from "./smart-packaging-layout.js";

export const SMART_PACKAGING_COMPONENT_PACK_IDS_V1 = [
  "MEDIA_STAGE",
  "SUPPORTING_TEXT",
  "SCREEN_FOCUS",
  "LOCAL_ANNOTATION",
  "EVIDENCE_CARD",
] as const;

export type SmartPackagingComponentPackIdV1 =
  (typeof SMART_PACKAGING_COMPONENT_PACK_IDS_V1)[number];

export type SmartPackagingComponentSelectionAuthorityV1 =
  "HOST_LAYOUT_PROJECTION" | "PROJECT_AGENT_EXPLICIT";

export interface SmartPackagingComponentPrimitiveDefinitionV1 {
  primitiveId: string;
  packId: SmartPackagingComponentPackIdV1;
  label: string;
  purpose: string;
  targetKinds: VisualRoleObjectKind[];
  targetRoles: Array<"MAIN" | "SUPPORTING">;
  selectionAuthority: SmartPackagingComponentSelectionAuthorityV1;
  requiresExplicitAnchor: boolean;
  rendererClass: string;
  rendererVersion: 1;
  lifecycle: "IMPLEMENTED_REVIEW_REQUIRED";
}

export const SMART_PACKAGING_COMPONENT_PRIMITIVES_V1 = [
  {
    primitiveId: "component:v1:stage-person-full",
    packId: "MEDIA_STAGE",
    label: "人物全屏舞台",
    purpose: "把已确认的人物主视觉按已确认布局铺满主舞台。",
    targetKinds: ["PERSON"],
    targetRoles: ["MAIN"],
    selectionAuthority: "HOST_LAYOUT_PROJECTION",
    requiresExplicitAnchor: false,
    rendererClass: "component-stage-person-full",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:stage-screen-main",
    packId: "MEDIA_STAGE",
    label: "录屏主舞台",
    purpose: "把已确认录屏作为最大信息主体并保持界面可读。",
    targetKinds: ["SCREEN_RECORDING"],
    targetRoles: ["MAIN"],
    selectionAuthority: "HOST_LAYOUT_PROJECTION",
    requiresExplicitAnchor: false,
    rendererClass: "component-stage-screen-main",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:stage-evidence-main",
    packId: "MEDIA_STAGE",
    label: "证据主舞台",
    purpose: "保持证据媒体最大、完整且不被装饰遮挡。",
    targetKinds: ["EVIDENCE_MEDIA"],
    targetRoles: ["MAIN"],
    selectionAuthority: "HOST_LAYOUT_PROJECTION",
    requiresExplicitAnchor: false,
    rendererClass: "component-stage-evidence-main",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:stage-detail-inset",
    packId: "MEDIA_STAGE",
    label: "细节嵌入舞台",
    purpose: "把真实局部证据作为从属嵌入画面，不升级为第二主视觉。",
    targetKinds: ["DETAIL_VIEW"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "HOST_LAYOUT_PROJECTION",
    requiresExplicitAnchor: false,
    rendererClass: "component-stage-detail-inset",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:stage-person-pip-circle",
    packId: "MEDIA_STAGE",
    label: "人物圆形画中画",
    purpose: "录屏或证据为主时，把人物保持为角落中的从属解释者。",
    targetKinds: ["PERSON_PIP"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "HOST_LAYOUT_PROJECTION",
    requiresExplicitAnchor: false,
    rendererClass: "component-stage-person-pip-circle",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:text-clean-card",
    packId: "SUPPORTING_TEXT",
    label: "重点文字卡",
    purpose: "用克制的卡片强调一条有证据的重点语义。",
    targetKinds: ["KEY_TEXT"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: false,
    rendererClass: "component-text-clean-card",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:text-marker-underline",
    packId: "SUPPORTING_TEXT",
    label: "重点下划线",
    purpose: "保留人物或录屏画面，只用绘制下划线强调关键文字。",
    targetKinds: ["KEY_TEXT"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: false,
    rendererClass: "component-text-marker-underline",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:text-context-label",
    packId: "SUPPORTING_TEXT",
    label: "上下文标签",
    purpose: "用一至两组 label/value 补充身份、条件或来源上下文。",
    targetKinds: ["CONTEXT_LABEL"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: false,
    rendererClass: "component-text-context-label",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:text-mini-explanation",
    packId: "SUPPORTING_TEXT",
    label: "迷你解释卡",
    purpose: "以从属卡片表达二至三个已确认节点或步骤。",
    targetKinds: ["MINI_EXPLANATION"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: false,
    rendererClass: "component-text-mini-explanation",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:screen-smart-zoom-restore",
    packId: "SCREEN_FOCUS",
    label: "智能推近并恢复",
    purpose: "围绕一个明确操作目标推近，完成后回到完整界面。",
    targetKinds: ["SCREEN_RECORDING"],
    targetRoles: ["MAIN"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: true,
    rendererClass: "component-screen-smart-zoom-restore",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:screen-spotlight-dim",
    packId: "SCREEN_FOCUS",
    label: "聚光压暗",
    purpose: "保持完整录屏可见，同时压暗目标之外的界面。",
    targetKinds: ["SCREEN_RECORDING"],
    targetRoles: ["MAIN"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: true,
    rendererClass: "component-screen-spotlight-dim",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:annotation-arrow",
    packId: "LOCAL_ANNOTATION",
    label: "箭头标注",
    purpose: "从已确认标注文字指向一个真实目标。",
    targetKinds: ["ANNOTATION"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: true,
    rendererClass: "component-annotation-arrow",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:annotation-circle",
    packId: "LOCAL_ANNOTATION",
    label: "圈选标注",
    purpose: "用闭合轮廓标出一个真实局部。",
    targetKinds: ["ANNOTATION"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: true,
    rendererClass: "component-annotation-circle",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:annotation-callout",
    packId: "LOCAL_ANNOTATION",
    label: "引线说明",
    purpose: "把已确认说明文字通过引线绑定到真实局部。",
    targetKinds: ["ANNOTATION"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: true,
    rendererClass: "component-annotation-callout",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:annotation-cursor",
    packId: "LOCAL_ANNOTATION",
    label: "光标引导",
    purpose: "把光标移动绑定到已确认的界面目标。",
    targetKinds: ["ANNOTATION"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: true,
    rendererClass: "component-annotation-cursor",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:annotation-click-ripple",
    packId: "LOCAL_ANNOTATION",
    label: "点击涟漪",
    purpose: "只在存在真实点击语义时标记一次点击反馈。",
    targetKinds: ["ANNOTATION"],
    targetRoles: ["SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: true,
    rendererClass: "component-annotation-click-ripple",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:evidence-clean-card",
    packId: "EVIDENCE_CARD",
    label: "纯净证据卡",
    purpose: "以低装饰边框展示真实图片、截图、视频或文档区域。",
    targetKinds: ["EVIDENCE_MEDIA", "DETAIL_VIEW"],
    targetRoles: ["MAIN", "SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: false,
    rendererClass: "component-evidence-clean-card",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:evidence-source-label",
    packId: "EVIDENCE_CARD",
    label: "证据来源标签",
    purpose: "显示宿主已绑定的真实素材名与来源类型，不生成新来源文案。",
    targetKinds: ["EVIDENCE_MEDIA", "DETAIL_VIEW"],
    targetRoles: ["MAIN", "SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: false,
    rendererClass: "component-evidence-source-label",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
  {
    primitiveId: "component:v1:evidence-device-frame",
    packId: "EVIDENCE_CARD",
    label: "设备窗口框",
    purpose: "把真实数字界面放入克制的浏览器或设备框，不改写内容。",
    targetKinds: ["EVIDENCE_MEDIA", "DETAIL_VIEW"],
    targetRoles: ["MAIN", "SUPPORTING"],
    selectionAuthority: "PROJECT_AGENT_EXPLICIT",
    requiresExplicitAnchor: false,
    rendererClass: "component-evidence-device-frame",
    rendererVersion: 1,
    lifecycle: "IMPLEMENTED_REVIEW_REQUIRED",
  },
] as const satisfies readonly SmartPackagingComponentPrimitiveDefinitionV1[];

export type SmartPackagingComponentPrimitiveIdV1 =
  (typeof SMART_PACKAGING_COMPONENT_PRIMITIVES_V1)[number]["primitiveId"];

export interface SmartPackagingComponentPackDefinitionV1 {
  packId: SmartPackagingComponentPackIdV1;
  label: string;
  purpose: string;
  primitiveIds: SmartPackagingComponentPrimitiveIdV1[];
}

const pack = (
  packId: SmartPackagingComponentPackIdV1,
  label: string,
  purpose: string,
): SmartPackagingComponentPackDefinitionV1 => ({
  packId,
  label,
  purpose,
  primitiveIds: SMART_PACKAGING_COMPONENT_PRIMITIVES_V1.filter(
    (primitive) => primitive.packId === packId,
  ).map((primitive) => primitive.primitiveId),
});

export const SMART_PACKAGING_COMPONENT_PACKS_V1 = [
  pack(
    "MEDIA_STAGE",
    "真实媒体舞台",
    "执行已确认布局中的人物、录屏、证据、细节与人物画中画。",
  ),
  pack(
    "SUPPORTING_TEXT",
    "副视觉文字",
    "包装已确认的重点文字、上下文标签与迷你解释。",
  ),
  pack("SCREEN_FOCUS", "录屏聚焦", "在真实目标存在时推近或压暗录屏界面。"),
  pack(
    "LOCAL_ANNOTATION",
    "局部标注",
    "用箭头、圈选、引线、光标或点击反馈绑定真实局部。",
  ),
  pack(
    "EVIDENCE_CARD",
    "证据媒体卡",
    "以纯净卡片、来源标签或设备窗口呈现真实证据。",
  ),
] as const satisfies readonly SmartPackagingComponentPackDefinitionV1[];

const componentCatalogSemanticV1 = {
  catalogId: "catalog:smart-packaging-component-pilot-v1",
  version: 1 as const,
  aspect: "LANDSCAPE_16_9" as const,
  lifecycle: "IMPLEMENTED_REVIEW_REQUIRED" as const,
  agentSelectionRequiredForCreativePrimitives: true as const,
  hostMayAutoSelectCreativePrimitive: false as const,
  projectMutationForbidden: true as const,
  packs: SMART_PACKAGING_COMPONENT_PACKS_V1,
  primitives: SMART_PACKAGING_COMPONENT_PRIMITIVES_V1,
};

export const SMART_PACKAGING_COMPONENT_CATALOG_V1 = Object.freeze({
  schemaVersion: 1 as const,
  ...componentCatalogSemanticV1,
  catalogHash: canonicalHash(componentCatalogSemanticV1),
});

export interface SmartPackagingComponentAuditionAnchorV1 {
  paragraphId: string;
  visualObjectId: string;
  xPermille: number;
  yPermille: number;
  widthPermille: number;
  heightPermille: number;
  provenance: "USER_AUDITION_CLICK";
}

export interface SmartPackagingComponentAuditionSelectionV1 {
  primitiveId: SmartPackagingComponentPrimitiveIdV1;
  visualObjectId: string;
}

export interface SmartPackagingComponentStructuralBindingV1 {
  primitiveId: SmartPackagingComponentPrimitiveIdV1;
  visualObjectId: string;
  rendererClass: string;
  state: "BOUND" | "BLOCKED";
  reasonCodes: string[];
}

export interface SmartPackagingComponentAuditionCandidateV1 {
  primitive: (typeof SMART_PACKAGING_COMPONENT_PRIMITIVES_V1)[number];
  visualObjectId: string;
  renderObjectId: string;
  state: "READY" | "NEEDS_AUDITION_ANCHOR" | "BLOCKED";
  reasonCodes: string[];
}

export interface SmartPackagingComponentAuditionV1 {
  schemaVersion: 1;
  paragraphId: string;
  catalogHash: string;
  isolation: {
    mode: "READ_ONLY_AUDITION";
    timelineModified: false;
    projectModified: false;
    agentPlanCreated: false;
  };
  structuralBindings: SmartPackagingComponentStructuralBindingV1[];
  candidates: SmartPackagingComponentAuditionCandidateV1[];
  selectedCandidate: SmartPackagingComponentAuditionCandidateV1 | null;
  state: "BASELINE" | "READY" | "BLOCKED";
  reasonCodes: string[];
}

const primitiveById = new Map(
  SMART_PACKAGING_COMPONENT_PRIMITIVES_V1.map((primitive) => [
    primitive.primitiveId,
    primitive,
  ]),
);

export function smartPackagingComponentPrimitiveV1(
  primitiveId: string,
): (typeof SMART_PACKAGING_COMPONENT_PRIMITIVES_V1)[number] | null {
  return (
    primitiveById.get(primitiveId as SmartPackagingComponentPrimitiveIdV1) ??
    null
  );
}

function sourceIsReady(
  primitive: (typeof SMART_PACKAGING_COMPONENT_PRIMITIVES_V1)[number],
  object: LayoutRealPreviewObjectV1,
): boolean {
  if (
    primitive.packId === "SUPPORTING_TEXT" ||
    primitive.packId === "LOCAL_ANNOTATION"
  ) {
    return object.source.state === "TEXT";
  }
  return object.source.state === "MEDIA";
}

function structuralPrimitiveForObject(
  object: LayoutRealPreviewObjectV1,
): (typeof SMART_PACKAGING_COMPONENT_PRIMITIVES_V1)[number] | null {
  const primitiveId =
    object.kind === "PERSON" && object.role === "MAIN"
      ? "component:v1:stage-person-full"
      : object.kind === "SCREEN_RECORDING" && object.role === "MAIN"
        ? "component:v1:stage-screen-main"
        : object.kind === "EVIDENCE_MEDIA" && object.role === "MAIN"
          ? "component:v1:stage-evidence-main"
          : object.kind === "DETAIL_VIEW" && object.role === "SUPPORTING"
            ? "component:v1:stage-detail-inset"
            : object.kind === "PERSON_PIP" && object.role === "SUPPORTING"
              ? "component:v1:stage-person-pip-circle"
              : null;
  return primitiveId === null
    ? null
    : smartPackagingComponentPrimitiveV1(primitiveId);
}

function structuralBindings(
  preview: LayoutRealPreviewV1,
): SmartPackagingComponentStructuralBindingV1[] {
  return preview.objects.flatMap((object) => {
    const primitive = structuralPrimitiveForObject(object);
    if (primitive === null) return [];
    const reasonCodes: string[] = [];
    if (!sourceIsReady(primitive, object))
      reasonCodes.push("COMPONENT_SOURCE_NOT_READY");
    if (
      primitive.primitiveId === "component:v1:stage-person-pip-circle" &&
      object.personTreatment !== "CIRCULAR_PIP"
    ) {
      reasonCodes.push("COMPONENT_PERSON_PIP_TREATMENT_UNSUPPORTED");
    }
    return [
      {
        primitiveId: primitive.primitiveId,
        visualObjectId: object.visualObjectId,
        rendererClass: primitive.rendererClass,
        state: reasonCodes.length === 0 ? "BOUND" : "BLOCKED",
        reasonCodes,
      },
    ];
  });
}

function candidateForObject(
  preview: LayoutRealPreviewV1,
  primitive: (typeof SMART_PACKAGING_COMPONENT_PRIMITIVES_V1)[number],
  object: LayoutRealPreviewObjectV1,
  anchor: SmartPackagingComponentAuditionAnchorV1 | null,
): SmartPackagingComponentAuditionCandidateV1 {
  const reasonCodes: string[] = [];
  let renderObjectId = object.visualObjectId;
  if (!sourceIsReady(primitive, object))
    reasonCodes.push("COMPONENT_SOURCE_NOT_READY");
  if (primitive.packId === "LOCAL_ANNOTATION") {
    const parent =
      object.parentVisualObjectId === null
        ? null
        : (preview.objects.find(
            (candidate) =>
              candidate.visualObjectId === object.parentVisualObjectId,
          ) ?? null);
    if (parent === null || parent.source.state !== "MEDIA") {
      reasonCodes.push("COMPONENT_ANNOTATION_PARENT_MEDIA_MISSING");
    } else {
      renderObjectId = parent.visualObjectId;
    }
    if (object.anchorRefIds.length === 0)
      reasonCodes.push("COMPONENT_ANNOTATION_EVIDENCE_MISSING");
  }
  const anchorMatchesObject =
    anchor !== null && anchor.visualObjectId === object.visualObjectId;
  if (primitive.requiresExplicitAnchor && !anchorMatchesObject) {
    return {
      primitive,
      visualObjectId: object.visualObjectId,
      renderObjectId,
      state: reasonCodes.length === 0 ? "NEEDS_AUDITION_ANCHOR" : "BLOCKED",
      reasonCodes:
        reasonCodes.length === 0
          ? ["COMPONENT_AUDITION_ANCHOR_REQUIRED"]
          : reasonCodes,
    };
  }
  return {
    primitive,
    visualObjectId: object.visualObjectId,
    renderObjectId,
    state: reasonCodes.length === 0 ? "READY" : "BLOCKED",
    reasonCodes,
  };
}

export function smartPackagingComponentAuditionCandidatesV1(
  preview: LayoutRealPreviewV1,
  anchor: SmartPackagingComponentAuditionAnchorV1 | null,
): SmartPackagingComponentAuditionCandidateV1[] {
  return SMART_PACKAGING_COMPONENT_PRIMITIVES_V1.flatMap((primitive) => {
    if (primitive.selectionAuthority !== "PROJECT_AGENT_EXPLICIT") return [];
    return preview.objects
      .filter(
        (object) =>
          primitive.targetKinds.some((kind) => kind === object.kind) &&
          primitive.targetRoles.some((role) => role === object.role),
      )
      .map((object) => candidateForObject(preview, primitive, object, anchor));
  });
}

export function buildSmartPackagingComponentAuditionV1(
  preview: LayoutRealPreviewV1,
  selection: SmartPackagingComponentAuditionSelectionV1 | null,
  anchor: SmartPackagingComponentAuditionAnchorV1 | null,
): SmartPackagingComponentAuditionV1 {
  const anchorMatchesParagraph =
    anchor === null || anchor.paragraphId === preview.paragraphId;
  const safeAnchor = anchorMatchesParagraph ? anchor : null;
  const candidates = smartPackagingComponentAuditionCandidatesV1(
    preview,
    safeAnchor,
  );
  const bindings = structuralBindings(preview);
  const selectedCandidate =
    selection === null
      ? null
      : (candidates.find(
          (candidate) =>
            candidate.primitive.primitiveId === selection.primitiveId &&
            candidate.visualObjectId === selection.visualObjectId,
        ) ?? null);
  const reasonCodes =
    preview.state === "READY" ? [] : ["COMPONENT_UPSTREAM_PREVIEW_INCOMPLETE"];
  reasonCodes.push(
    ...bindings.flatMap((binding) =>
      binding.state === "BLOCKED" ? binding.reasonCodes : [],
    ),
  );
  if (!anchorMatchesParagraph)
    reasonCodes.push("COMPONENT_AUDITION_ANCHOR_STALE");
  if (
    selectedCandidate !== null &&
    safeAnchor !== null &&
    safeAnchor.visualObjectId !== selectedCandidate.visualObjectId
  ) {
    reasonCodes.push("COMPONENT_AUDITION_ANCHOR_TARGET_STALE");
  }
  if (selection !== null && selectedCandidate === null)
    reasonCodes.push("COMPONENT_SELECTION_STALE");
  if (selectedCandidate !== null && selectedCandidate.state !== "READY") {
    reasonCodes.push(...selectedCandidate.reasonCodes);
  }
  const uniqueReasonCodes = [...new Set(reasonCodes)];
  return {
    schemaVersion: 1,
    paragraphId: preview.paragraphId,
    catalogHash: SMART_PACKAGING_COMPONENT_CATALOG_V1.catalogHash,
    isolation: {
      mode: "READ_ONLY_AUDITION",
      timelineModified: false,
      projectModified: false,
      agentPlanCreated: false,
    },
    structuralBindings: bindings,
    candidates,
    selectedCandidate,
    state:
      uniqueReasonCodes.length > 0
        ? "BLOCKED"
        : selectedCandidate === null
          ? "BASELINE"
          : "READY",
    reasonCodes: uniqueReasonCodes,
  };
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

export function smartPackagingComponentAuditionAnchorFromPointV1(
  paragraphId: string,
  visualObjectId: string,
  xPermille: number,
  yPermille: number,
): SmartPackagingComponentAuditionAnchorV1 {
  const widthPermille = 180;
  const heightPermille = 140;
  return {
    paragraphId,
    visualObjectId,
    xPermille: clampInteger(
      xPermille - widthPermille / 2,
      0,
      1_000 - widthPermille,
    ),
    yPermille: clampInteger(
      yPermille - heightPermille / 2,
      0,
      1_000 - heightPermille,
    ),
    widthPermille,
    heightPermille,
    provenance: "USER_AUDITION_CLICK",
  };
}

export function smartPackagingComponentAuditionAnchorStyleV1(
  anchor: SmartPackagingComponentAuditionAnchorV1,
): string {
  const centerX = anchor.xPermille + anchor.widthPermille / 2;
  const centerY = anchor.yPermille + anchor.heightPermille / 2;
  return [
    `--component-anchor-left:${anchor.xPermille / 10}%`,
    `--component-anchor-top:${anchor.yPermille / 10}%`,
    `--component-anchor-width:${anchor.widthPermille / 10}%`,
    `--component-anchor-height:${anchor.heightPermille / 10}%`,
    `--component-anchor-x:${centerX / 10}%`,
    `--component-anchor-y:${centerY / 10}%`,
  ].join(";");
}

export function smartPackagingComponentObjectClassesV1(
  audition: SmartPackagingComponentAuditionV1,
  visualObjectId: string,
): string[] {
  const classes = audition.structuralBindings
    .filter(
      (binding) =>
        binding.visualObjectId === visualObjectId && binding.state === "BOUND",
    )
    .map((binding) => binding.rendererClass);
  const selected = audition.selectedCandidate;
  if (
    selected?.state === "READY" &&
    selected.renderObjectId === visualObjectId
  ) {
    classes.push(selected.primitive.rendererClass);
  }
  return classes;
}
