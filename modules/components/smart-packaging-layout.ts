import type {
  LayoutCatalogVariantV1,
  LayoutFoundationObjectV1,
  LayoutPlanParagraphV1,
  LayoutPlanProposalV1,
  LayoutPlanV1,
  LayoutSnapshotV1,
  LayoutVariantIdV1,
  VisualParagraphDecision,
  VisualParagraphProposal,
  VisualRoleMaterialSelector,
  VisualRoleObject,
  VisualRoleSnapshot,
} from "./contracts.js";
import type { TimelineDocumentV2 } from "./editor-v2/types.js";

export type LayoutRealPreviewSourceV1 =
  | {
    state: "MEDIA";
    mediaKind: "VIDEO" | "IMAGE";
    locator: string;
    displayName: string;
    sourceKind: string;
    representativeTimeSeconds: number | null;
    selector: VisualRoleMaterialSelector | null;
    sourceCount: number;
  }
  | { state: "TEXT"; lines: string[] }
  | { state: "DECORATIVE"; label: string }
  | { state: "MISSING"; code: string; message: string };

export interface LayoutRealPreviewObjectV1 {
  visualObjectId: string;
  visualObjectHash: string;
  layoutSlotId: LayoutPlanParagraphV1["geometry"]["slots"][number]["layoutSlotId"];
  role: "MAIN" | "SUPPORTING";
  kind: VisualRoleObject["kind"];
  informationDuty: string;
  frame: LayoutPlanParagraphV1["geometry"]["slots"][number]["normalizedFrame"];
  zIndex: number;
  personTreatment: LayoutPlanParagraphV1["geometry"]["slots"][number]["personTreatment"];
  parentVisualObjectId: string | null;
  anchorRefIds: string[];
  source: LayoutRealPreviewSourceV1;
}

export interface LayoutRealPreviewV1 {
  state: "READY" | "INCOMPLETE";
  paragraphId: string;
  representativeTimelineFrame: number;
  captionText: string | null;
  objects: LayoutRealPreviewObjectV1[];
  reasonCodes: string[];
}

export const layoutParagraphReadinessLabels: Record<LayoutSnapshotV1["paragraphReadiness"][number]["state"], string> = {
  STALE: "上游已变化",
  PENDING_PROPOSAL: "等待决定局部方案",
  PENDING_REVIEW: "等待逐段复核",
  REJECTED: "已退回，等待修订",
  ACCEPTED: "本段已接受",
};

export function layoutReviewReadinessLabel(snapshot: LayoutSnapshotV1): string {
  switch (snapshot.reviewReadiness.code) {
    case "UPSTREAM_NOT_READY": return "先完成主副视觉 V2 复核";
    case "NO_CURRENT_PLAN": return "等待 AI 选择母版";
    case "STALE_PARAGRAPHS": return `有 ${snapshot.reviewReadiness.staleParagraphIds.length} 段已失效`;
    case "PENDING_PROPOSAL": return "等待你决定局部布局 Proposal";
    case "PARAGRAPH_REVIEW_REQUIRED": {
      const rejected = snapshot.reviewReadiness.rejectedParagraphIds.length;
      if (rejected > 0) return `${rejected} 段已退回，等待 Agent 修订`;
      return `还有 ${snapshot.reviewReadiness.pendingReviewParagraphIds.length} 段待复核`;
    }
    case "READY": return "全部段落已接受，可以完成布局复核";
    case "CONFIRMED": return "Layout V1 已完成复核";
  }
}

export function currentPendingLayoutProposal(snapshot: LayoutSnapshotV1): LayoutPlanProposalV1 | null {
  const plan = snapshot.currentPlan;
  if (plan === null) return null;
  return [...snapshot.proposals].reverse().find((proposal) =>
    proposal.status === "PENDING"
    && proposal.basePlanId === plan.planId
    && proposal.basePlanHash === plan.planHash,
  ) ?? null;
}

export function candidateLayoutPlan(
  snapshot: LayoutSnapshotV1,
  proposal: LayoutPlanProposalV1 | null,
): LayoutPlanV1 | null {
  if (proposal?.candidatePlanId === null || proposal?.candidatePlanHash === null || proposal === null) return null;
  return snapshot.plans.find((plan) =>
    plan.planId === proposal.candidatePlanId && plan.planHash === proposal.candidatePlanHash,
  ) ?? null;
}

export function layoutPlanParagraph(
  plan: LayoutPlanV1 | null,
  paragraphId: string | null,
): LayoutPlanParagraphV1 | null {
  if (plan === null || paragraphId === null) return null;
  return plan.paragraphs.find((paragraph) => paragraph.paragraphId === paragraphId) ?? null;
}

export function layoutParagraphOrder(plan: LayoutPlanV1, paragraphId: string): number {
  return plan.paragraphs.findIndex((paragraph) => paragraph.paragraphId === paragraphId);
}

export function layoutVariant(
  snapshot: LayoutSnapshotV1,
  variantId: LayoutVariantIdV1,
): LayoutCatalogVariantV1 | null {
  return snapshot.catalog.variants.find((variant) => variant.variantId === variantId) ?? null;
}

export function layoutFoundationObject(
  snapshot: LayoutSnapshotV1,
  paragraphId: string,
  visualObjectId: string,
): LayoutFoundationObjectV1 | null {
  return snapshot.currentFoundation?.paragraphs
    .find((paragraph) => paragraph.paragraphId === paragraphId)
    ?.objects.find((object) => object.visualObjectId === visualObjectId) ?? null;
}

function safeProjectLocator(locator: string): boolean {
  if (locator.length === 0 || locator.startsWith("/") || locator.includes("\\")) return false;
  const segments = locator.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function visualObjectTextLines(object: VisualRoleObject): string[] {
  const content = object.content;
  const directText = typeof content.text === "string" ? content.text.trim() : "";
  if (directText) return [directText];

  if (Array.isArray(content.items)) {
    const items = content.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (items.length > 0) return items.map((item) => item.trim());
  }
  if (Array.isArray(content.orderedOperations)) {
    const operations = content.orderedOperations.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (operations.length > 0) return operations.map((item) => item.trim());
  }
  if (Array.isArray(content.entries)) {
    const entries = content.entries.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const value = entry as { label?: unknown; value?: unknown };
      if (typeof value.label !== "string") return [];
      return [typeof value.value === "string" ? `${value.label} ${value.value}`.trim() : value.label.trim()];
    }).filter(Boolean);
    if (entries.length > 0) return entries;
  }
  if (Array.isArray(content.anchors)) {
    const anchors = content.anchors.flatMap((anchor) => {
      if (typeof anchor !== "object" || anchor === null) return [];
      const label = (anchor as { label?: unknown }).label;
      return typeof label === "string" && label.trim() ? [label.trim()] : [];
    });
    if (anchors.length > 0) return anchors;
  }
  return [];
}

function sourceKindUsage(sourceKind: string): "a_roll" | "screen_recording" | null {
  if (sourceKind === "PERSON_SEGMENT") return "a_roll";
  if (sourceKind === "SCREEN_SEGMENT") return "screen_recording";
  return null;
}

function representativeClip(
  documentValue: TimelineDocumentV2,
  paragraph: VisualParagraphDecision,
  assetId: string,
) {
  const allowedClipIds = new Set(paragraph.hostBindings
    .filter((binding) => binding.assetId === assetId)
    .map((binding) => binding.clipId));
  return documentValue.clips
    .filter((clip) => allowedClipIds.has(clip.clipId) && clip.sourceBinding?.assetId === assetId)
    .map((clip) => {
      const start = Math.max(paragraph.frameRange.startFrame, clip.timelineRange.startFrame);
      const end = Math.min(paragraph.frameRange.endFrame, clip.timelineRange.endFrame);
      return { clip, start, end, overlap: Math.max(0, end - start) };
    })
    .filter((candidate) => candidate.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap || left.start - right.start)[0] ?? null;
}

function representativeSourceTimeSeconds(
  documentValue: TimelineDocumentV2,
  paragraph: VisualParagraphDecision,
  assetId: string,
): number | null {
  const candidate = representativeClip(documentValue, paragraph, assetId);
  const binding = candidate?.clip.sourceBinding;
  if (candidate === null || binding === null || binding === undefined) return null;
  const framesPerSecond = documentValue.timebase.framesPerSecond.numerator
    / documentValue.timebase.framesPerSecond.denominator;
  if (!Number.isFinite(framesPerSecond) || framesPerSecond <= 0) return null;
  const representativeFrame = candidate.start + Math.floor(candidate.overlap / 2);
  const timelineDeltaMs = ((representativeFrame - candidate.clip.timelineRange.startFrame) / framesPerSecond) * 1_000;
  const playbackRate = binding.playbackRate.numerator / binding.playbackRate.denominator;
  const sourceDeltaMs = timelineDeltaMs * playbackRate;
  const sourceMs = binding.playbackDirection === "reverse"
    ? binding.sourceRange.endMs - sourceDeltaMs
    : binding.sourceRange.startMs + sourceDeltaMs;
  return Math.max(binding.sourceRange.startMs, Math.min(binding.sourceRange.endMs, sourceMs)) / 1_000;
}

function missingSource(code: string, message: string): LayoutRealPreviewSourceV1 {
  return { state: "MISSING", code, message };
}

function materialSelectorForSource(
  visualRole: VisualRoleSnapshot,
  sourceRefId: string,
  derivedRegionOrSegmentId: string | null,
): VisualRoleMaterialSelector | null {
  const binding = [...visualRole.bindings].reverse().find((candidate) =>
    candidate.status === "SATISFIED" && candidate.sourceRefIds.includes(sourceRefId)) ?? null;
  if (binding === null) return null;
  const sourceIndex = binding.sourceRefIds.indexOf(sourceRefId);
  const indexedSelectionId = binding.sourceSelectionIds?.[sourceIndex] ?? null;
  const selection = visualRole.materialSelections.find((candidate) =>
    (indexedSelectionId !== null && candidate.selectionId === indexedSelectionId)
    || (derivedRegionOrSegmentId !== null && candidate.derivedRegionOrSegmentId === derivedRegionOrSegmentId)) ?? null;
  return selection?.selector ?? null;
}

function mediaSourceForRef(
  documentValue: TimelineDocumentV2,
  paragraph: VisualParagraphDecision,
  visualRole: VisualRoleSnapshot,
  sourceRefId: string,
  sourceKind: string,
  contentHash: string,
): LayoutRealPreviewSourceV1 {
  const currentPlan = visualRole.currentPlan;
  if (currentPlan === null) return missingSource("PREVIEW_VISUAL_ROLE_PLAN_MISSING", "当前主副视觉 Plan 已失效");
  const manifest = visualRole.manifests.find((candidate) =>
    candidate.manifestId === currentPlan.materialManifestId
    && candidate.manifestHash === currentPlan.materialManifestHash) ?? null;
  const entry = manifest?.entries.find((candidate) => candidate.sourceRefId === sourceRefId) ?? null;
  if (entry === null
    || entry.sourceKind !== sourceKind
    || entry.contentHash !== contentHash
    || entry.manifestHash !== currentPlan.materialManifestHash) {
    return missingSource("PREVIEW_SOURCE_REF_STALE", "来源与当前已确认 Manifest 不一致");
  }

  const materialAsset = entry.assetId === null
    ? null
    : visualRole.materialAssets.find((candidate) => candidate.assetId === entry.assetId) ?? null;
  if (materialAsset !== null) {
    if (!safeProjectLocator(materialAsset.locator)) {
      return missingSource("PREVIEW_LOCATOR_INVALID", "素材定位超出项目边界");
    }
    const mediaKind = materialAsset.technicalMetadata.mediaKind;
    if (mediaKind !== "VIDEO" && mediaKind !== "IMAGE") {
      return missingSource("PREVIEW_MEDIA_UNSUPPORTED", "当前素材类型尚不能生成画面预览");
    }
    const selector = materialSelectorForSource(visualRole, sourceRefId, entry.derivedRegionOrSegmentId);
    const representativeTimeSeconds = selector?.kind === "VIDEO_SEGMENT"
      ? (selector.startFrame + Math.floor((selector.endFrame - selector.startFrame) / 2))
        / (documentValue.timebase.framesPerSecond.numerator / documentValue.timebase.framesPerSecond.denominator)
      : null;
    return {
      state: "MEDIA",
      mediaKind,
      locator: materialAsset.locator,
      displayName: materialAsset.displayName,
      sourceKind,
      representativeTimeSeconds,
      selector,
      sourceCount: 1,
    };
  }

  const directAsset = entry.assetId === null
    ? null
    : documentValue.assets.find((candidate) => candidate.assetId === entry.assetId) ?? null;
  const expectedUsage = sourceKindUsage(sourceKind);
  const boundAssets = paragraph.hostBindings
    .map((binding) => documentValue.assets.find((candidate) => candidate.assetId === binding.assetId) ?? null)
    .filter((asset): asset is TimelineDocumentV2["assets"][number] => asset !== null)
    .filter((asset) => expectedUsage === null || asset.usage === expectedUsage);
  const asset = directAsset ?? boundAssets[0] ?? null;
  if (asset === null || asset.offline || (asset.kind !== "video" && asset.kind !== "image")) {
    return missingSource("PREVIEW_BOUND_MEDIA_MISSING", "当前来源没有可读取的项目素材");
  }
  if (!safeProjectLocator(asset.locator)) {
    return missingSource("PREVIEW_LOCATOR_INVALID", "项目素材定位超出项目边界");
  }
  return {
    state: "MEDIA",
    mediaKind: asset.kind === "video" ? "VIDEO" : "IMAGE",
    locator: asset.locator,
    displayName: asset.name,
    sourceKind,
    representativeTimeSeconds: asset.kind === "video"
      ? representativeSourceTimeSeconds(documentValue, paragraph, asset.assetId)
      : null,
    selector: null,
    sourceCount: Math.max(1, new Set(boundAssets.map((candidate) => candidate.assetId)).size),
  };
}

function existingSourceRefIsCurrent(
  visualRole: VisualRoleSnapshot,
  source: Extract<VisualRoleObject["source"], { mode: "EXISTING_SOURCE" }>,
): boolean {
  const currentPlan = visualRole.currentPlan;
  if (currentPlan === null || source.manifestHash !== currentPlan.materialManifestHash) return false;
  const manifest = visualRole.manifests.find((candidate) =>
    candidate.manifestId === currentPlan.materialManifestId
    && candidate.manifestHash === currentPlan.materialManifestHash) ?? null;
  return manifest?.entries.some((entry) =>
    entry.sourceRefId === source.sourceRefId
    && entry.sourceKind === source.sourceKind
    && entry.contentHash === source.contentHash
    && entry.manifestHash === currentPlan.materialManifestHash) === true;
}

function satisfiedMaterialBinding(
  visualRole: VisualRoleSnapshot,
  requirementId: string,
) {
  const requirement = visualRole.requirements.find((candidate) => candidate.requirementId === requirementId) ?? null;
  const binding = requirement === null ? null : [...visualRole.bindings].reverse().find((candidate) =>
    candidate.requirementId === requirement.requirementId && candidate.status === "SATISFIED") ?? null;
  return requirement?.status === "SATISFIED" && binding !== null ? binding : null;
}

function previewSourceForObject(
  documentValue: TimelineDocumentV2,
  paragraph: VisualParagraphDecision,
  visualRole: VisualRoleSnapshot,
  roleObjects: VisualRoleObject[],
  object: VisualRoleObject,
  visited: Set<string>,
): LayoutRealPreviewSourceV1 {
  const textLines = visualObjectTextLines(object);
  const textObject = ["TEXT_COMPOSITION", "STRUCTURED_EXPLANATION", "KEY_TEXT", "ANNOTATION", "CONTEXT_LABEL", "MINI_EXPLANATION"]
    .includes(object.kind);
  if (textObject) {
    if (object.source.mode === "EXISTING_SOURCE" && !existingSourceRefIsCurrent(visualRole, object.source)) {
      return missingSource("PREVIEW_SOURCE_REF_STALE", "文字来源与当前已确认 Manifest 不一致");
    }
    if (object.source.mode === "MATERIAL_REQUIREMENT"
      && satisfiedMaterialBinding(visualRole, object.source.requirementId) === null) {
      return missingSource("PREVIEW_MATERIAL_BINDING_MISSING", "文字素材尚未完成语义确认与绑定");
    }
    if (object.source.mode === "DERIVED_FROM_PARENT") {
      const parentVisualObjectId = object.source.parentVisualObjectId;
      const parent = roleObjects.find((candidate) => candidate.visualObjectId === parentVisualObjectId) ?? null;
      if (parent === null || visited.has(object.visualObjectId)) {
        return missingSource("PREVIEW_PARENT_SOURCE_MISSING", "文字派生来源已失效");
      }
      const nextVisited = new Set(visited);
      nextVisited.add(object.visualObjectId);
      const parentSource = previewSourceForObject(documentValue, paragraph, visualRole, roleObjects, parent, nextVisited);
      if (parentSource.state === "MISSING") return parentSource;
    }
    if (object.source.mode === "NO_EXTERNAL_MATERIAL") {
      return missingSource("PREVIEW_TEXT_PROVENANCE_MISSING", "文字对象没有已确认来源");
    }
    return textLines.length > 0
      ? { state: "TEXT", lines: textLines }
      : missingSource("PREVIEW_TEXT_CONTENT_MISSING", "已确认对象没有可展示的文字内容");
  }
  if (object.kind === "DECORATIVE_ACCENT" && object.source.mode === "NO_EXTERNAL_MATERIAL") {
    return { state: "DECORATIVE", label: object.informationDuty };
  }
  if (object.source.mode === "EXISTING_SOURCE") {
    return mediaSourceForRef(
      documentValue,
      paragraph,
      visualRole,
      object.source.sourceRefId,
      object.source.sourceKind,
      object.source.contentHash,
    );
  }
  if (object.source.mode === "MATERIAL_REQUIREMENT") {
    const requirementId = object.source.requirementId;
    const binding = satisfiedMaterialBinding(visualRole, requirementId);
    if (binding === null || binding.sourceRefIds.length === 0) {
      return missingSource("PREVIEW_MATERIAL_BINDING_MISSING", "理想方案素材尚未完成语义确认与绑定");
    }
    const currentPlan = visualRole.currentPlan;
    const manifest = currentPlan === null ? null : visualRole.manifests.find((candidate) =>
      candidate.manifestId === currentPlan.materialManifestId
      && candidate.manifestHash === currentPlan.materialManifestHash) ?? null;
    const firstRef = manifest?.entries.find((entry) => entry.sourceRefId === binding.sourceRefIds[0]) ?? null;
    if (firstRef === null) return missingSource("PREVIEW_BOUND_SOURCE_MISSING", "绑定来源不在当前 Manifest 中");
    if (binding.sourceContentHashes[0] !== firstRef.contentHash) {
      return missingSource("PREVIEW_BOUND_SOURCE_STALE", "绑定来源内容哈希已变化");
    }
    const source = mediaSourceForRef(
      documentValue,
      paragraph,
      visualRole,
      firstRef.sourceRefId,
      firstRef.sourceKind,
      firstRef.contentHash,
    );
    return source.state === "MEDIA" ? { ...source, sourceCount: binding.sourceRefIds.length } : source;
  }
  if (object.source.mode === "DERIVED_FROM_PARENT") {
    const parentVisualObjectId = object.source.parentVisualObjectId;
    if (visited.has(object.visualObjectId)) {
      return missingSource("PREVIEW_DERIVED_SOURCE_CYCLE", "派生视觉来源形成循环引用");
    }
    const parent = roleObjects.find((candidate) => candidate.visualObjectId === parentVisualObjectId) ?? null;
    if (parent === null) return missingSource("PREVIEW_PARENT_SOURCE_MISSING", "派生视觉的父对象已失效");
    const nextVisited = new Set(visited);
    nextVisited.add(object.visualObjectId);
    return previewSourceForObject(documentValue, paragraph, visualRole, roleObjects, parent, nextVisited);
  }
  return missingSource("PREVIEW_SOURCE_UNSUPPORTED", "当前对象没有可执行的预览来源");
}

export function deriveLayoutRealPreview(
  documentValue: TimelineDocumentV2,
  paragraphProposal: VisualParagraphProposal | null,
  visualRole: VisualRoleSnapshot | null,
  layoutSnapshot: LayoutSnapshotV1,
  plan: LayoutPlanV1,
  paragraphId: string,
): LayoutRealPreviewV1 {
  const layoutParagraph = layoutPlanParagraph(plan, paragraphId);
  const rolePlan = visualRole?.currentPlan ?? null;
  const proposalParagraph = paragraphProposal?.paragraphs.find((candidate) => candidate.paragraphId === paragraphId) ?? null;
  const roleParagraph = rolePlan?.paragraphs.find((candidate) => candidate.paragraphId === paragraphId) ?? null;
  const foundation = layoutSnapshot.currentFoundation;
  const roleConfirmation = foundation === null || visualRole === null ? null : visualRole.confirmations.find((candidate) =>
    candidate.confirmationId === foundation.visualRoleConfirmationId
    && candidate.confirmationHash === foundation.visualRoleConfirmationHash
    && candidate.status === "CONFIRMED"
    && candidate.planId === foundation.visualRolePlanId
    && candidate.planHash === foundation.visualRolePlanHash
    && candidate.materialManifestHash === foundation.materialManifestHash) ?? null;
  const layoutConfirmation = foundation === null ? null : layoutSnapshot.confirmations.find((candidate) =>
    candidate.confirmationId === layoutSnapshot.reviewReadiness.confirmationId
    && candidate.status === "CONFIRMED"
    && candidate.planId === plan.planId
    && candidate.planHash === plan.planHash
    && candidate.foundationHash === foundation.foundationHash
    && candidate.catalogHash === foundation.catalogHash) ?? null;
  const manifest = rolePlan === null || visualRole === null ? null : visualRole.manifests.find((candidate) =>
    candidate.manifestId === rolePlan.materialManifestId
    && candidate.manifestHash === rolePlan.materialManifestHash) ?? null;
  const foundationIdentityIsUsable = foundation !== null && (
    (plan.foundationId === foundation.foundationId && plan.foundationHash === foundation.foundationHash)
    || (layoutSnapshot.reviewReadiness.code === "CONFIRMED" && layoutConfirmation !== null)
  );
  const identitiesMatch = rolePlan !== null
    && rolePlan.planId === plan.visualRolePlanId
    && rolePlan.planHash === plan.visualRolePlanHash
    && rolePlan.projectId === plan.projectId
    && rolePlan.sessionId === plan.sessionId
    && rolePlan.timelineId === plan.timelineId
    && rolePlan.baseRevision === plan.baseRevision
    && rolePlan.materialManifestId === plan.materialManifestId
    && rolePlan.materialManifestHash === plan.materialManifestHash
    && paragraphProposal !== null
    && foundation !== null
    && foundationIdentityIsUsable
    && plan.catalogId === layoutSnapshot.catalog.catalogId
    && plan.catalogHash === layoutSnapshot.catalog.catalogHash
    && foundation.catalogId === plan.catalogId
    && foundation.catalogHash === plan.catalogHash
    && foundation.projectId === plan.projectId
    && foundation.sessionId === plan.sessionId
    && foundation.timelineId === plan.timelineId
    && foundation.baseRevision === plan.baseRevision
    && foundation.visualRolePlanId === plan.visualRolePlanId
    && foundation.visualRolePlanHash === plan.visualRolePlanHash
    && foundation.materialManifestId === plan.materialManifestId
    && foundation.materialManifestHash === plan.materialManifestHash
    && paragraphProposal.proposalId === foundation.visualParagraphProposalId
    && paragraphProposal.proposalHash === foundation.visualParagraphProposalHash
    && paragraphProposal.projectId === plan.projectId
    && paragraphProposal.sessionId === plan.sessionId
    && paragraphProposal.timelineId === plan.timelineId
    && paragraphProposal.baseRevision === plan.baseRevision
    && visualRole?.reviewReadiness.code === "CONFIRMED"
    && visualRole.reviewReadiness.confirmationId === foundation.visualRoleConfirmationId
    && roleConfirmation !== null
    && manifest !== null
    && manifest.projectId === plan.projectId
    && manifest.timelineId === plan.timelineId
    && manifest.revision === plan.baseRevision
    && documentValue.projectId === plan.projectId
    && documentValue.timelineId === plan.timelineId
    && documentValue.revision === plan.baseRevision;
  if (layoutParagraph === null || roleParagraph === null || proposalParagraph === null || !identitiesMatch || visualRole === null) {
    return {
      state: "INCOMPLETE",
      paragraphId,
      representativeTimelineFrame: proposalParagraph?.frameRange.startFrame ?? 0,
      captionText: null,
      objects: [],
      reasonCodes: ["PREVIEW_UPSTREAM_IDENTITY_MISMATCH"],
    };
  }

  const roleObjects = [roleParagraph.mainVisual, ...roleParagraph.supportingVisuals];
  const objects = layoutParagraph.geometry.slots.map((slot): LayoutRealPreviewObjectV1 => {
    const mapping = layoutParagraph.objectSlotMappings.find((candidate) =>
      candidate.layoutSlotId === slot.layoutSlotId && candidate.visualObjectId === slot.visualObjectId) ?? null;
    const roleObject = roleObjects.find((candidate) => candidate.visualObjectId === slot.visualObjectId) ?? null;
    const foundationObject = layoutFoundationObject(layoutSnapshot, paragraphId, slot.visualObjectId);
    const exactObject = roleObject !== null
      && mapping?.visualObjectHash === roleObject.visualObjectHash
      && foundationObject?.visualObjectHash === roleObject.visualObjectHash;
    const source = exactObject
      ? previewSourceForObject(documentValue, proposalParagraph, visualRole, roleObjects, roleObject, new Set())
      : missingSource("PREVIEW_OBJECT_IDENTITY_MISMATCH", "布局对象与已确认主副视觉不一致");
    return {
      visualObjectId: slot.visualObjectId,
      visualObjectHash: roleObject?.visualObjectHash ?? mapping?.visualObjectHash ?? "",
      layoutSlotId: slot.layoutSlotId,
      role: slot.layoutSlotId === "MAIN_STAGE" ? "MAIN" : "SUPPORTING",
      kind: roleObject?.kind ?? foundationObject?.kind ?? "DECORATIVE_ACCENT",
      informationDuty: roleObject?.informationDuty ?? foundationObject?.informationDuty ?? "对象已失效",
      frame: slot.normalizedFrame,
      zIndex: slot.zIndex,
      personTreatment: slot.personTreatment,
      parentVisualObjectId: roleObject?.source.mode === "DERIVED_FROM_PARENT"
        ? roleObject.source.parentVisualObjectId
        : null,
      anchorRefIds: roleObject?.source.mode === "DERIVED_FROM_PARENT"
        ? [...roleObject.source.anchorRefIds]
        : [],
      source,
    };
  });
  const reasonCodes = objects.flatMap((object) => object.source.state === "MISSING" ? [object.source.code] : []);
  const representativeTimelineFrame = proposalParagraph.frameRange.startFrame
    + Math.floor((proposalParagraph.frameRange.endFrame - proposalParagraph.frameRange.startFrame) / 2);
  const representativeMs = (representativeTimelineFrame
    / (documentValue.timebase.framesPerSecond.numerator / documentValue.timebase.framesPerSecond.denominator)) * 1_000;
  const captionText = documentValue.captionCues.find((cue) =>
    cue.startMs <= representativeMs && cue.endMs > representativeMs && cue.confirmed)?.text ?? null;
  return {
    state: reasonCodes.length === 0 ? "READY" : "INCOMPLETE",
    paragraphId,
    representativeTimelineFrame,
    captionText,
    objects,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

export function layoutSlotPreviewStyle(
  slot: Pick<LayoutPlanParagraphV1["geometry"]["slots"][number], "normalizedFrame" | "zIndex" | "personTreatment">,
): string {
  const frame = slot.normalizedFrame;
  const radius = slot.personTreatment === "CIRCULAR_PIP" ? "50%" : "12px";
  return [
    `left:${frame.xPermille / 10}%`,
    `top:${frame.yPermille / 10}%`,
    `width:${frame.widthPermille / 10}%`,
    `height:${frame.heightPermille / 10}%`,
    `z-index:${slot.zIndex}`,
    `border-radius:${radius}`,
  ].join(";");
}

export function mainRemainsLargest(paragraph: LayoutPlanParagraphV1): boolean {
  const main = paragraph.geometry.slots.find((slot) => slot.layoutSlotId === "MAIN_STAGE");
  if (main === undefined) return false;
  return paragraph.geometry.slots
    .filter((slot) => slot.layoutSlotId !== "MAIN_STAGE")
    .every((slot) => slot.areaSharePermille < main.areaSharePermille);
}
