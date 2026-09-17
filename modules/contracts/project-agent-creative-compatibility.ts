import type { LayoutCatalogVariantV1 } from "./layout-contract.js";
import { layoutVariantById } from "./layout-catalog.js";
import type { ProjectAgentCreativeParagraphSubmissionV1 } from "./project-director-contract.js";
import { sceneRelationCatalogItem } from "./scene-direction-catalog.js";

type VisualObject = ProjectAgentCreativeParagraphSubmissionV1["objects"][number];
type MainKind = LayoutCatalogVariantV1["allowedMainKinds"][number];
type SupportingKind = LayoutCatalogVariantV1["allowedSupportingKinds"][number];

export interface ProjectAgentCreativeCompatibilityIssue {
  code:
    | "PROJECT_AGENT_PARAGRAPH_STRUCTURE_INVALID"
    | "PROJECT_AGENT_GROUP_CONTENT_MISSING"
    | "PROJECT_AGENT_OBJECT_PARENT_INVALID"
    | "PROJECT_AGENT_MAIN_KIND_INVALID"
    | "PROJECT_AGENT_LAYOUT_VARIANT_NOT_FOUND"
    | "PROJECT_AGENT_LAYOUT_RELATION_INCOMPATIBLE"
    | "PROJECT_AGENT_LAYOUT_MAIN_KIND_INCOMPATIBLE"
    | "PROJECT_AGENT_LAYOUT_SUPPORT_INCOMPATIBLE"
    | "PROJECT_AGENT_LAYOUT_SLOT_INCOMPATIBLE"
    | "PROJECT_AGENT_LAYOUT_TEXT_CAPACITY_EXCEEDED";
  path: Array<string | number>;
  message: string;
}

const invalidMainKinds = new Set<VisualObject["kind"]>([
  "CALLOUT",
  "HIGHLIGHT",
  "CONNECTOR_SET",
  "BACKGROUND_SCAFFOLD",
]);

export function directorMainLayoutKind(kind: VisualObject["kind"]): MainKind | null {
  if (kind === "PERSON") return "PERSON";
  if (kind === "SCREEN_RECORDING") return "SCREEN_RECORDING";
  if (["FOOTAGE", "IMAGE", "DOCUMENT"].includes(kind)) return "EVIDENCE_MEDIA";
  if (kind === "TEXT") return "TEXT_COMPOSITION";
  if (invalidMainKinds.has(kind)) return null;
  return "STRUCTURED_EXPLANATION";
}

export function directorSupportingLayoutKind(object: VisualObject): SupportingKind {
  if (object.kind === "PERSON") return "PERSON_PIP";
  if (["SCREEN_RECORDING", "FOOTAGE", "IMAGE", "DOCUMENT"].includes(object.kind)) return "DETAIL_VIEW";
  if (["CALLOUT", "HIGHLIGHT"].includes(object.kind)) return "ANNOTATION";
  if (["CONNECTOR_SET", "BACKGROUND_SCAFFOLD"].includes(object.kind) || object.objectClass === "DECORATION") {
    return "DECORATIVE_ACCENT";
  }
  if (object.textRole === "OBJECT_NAME" || object.textRole === "RELATION_LABEL") return "CONTEXT_LABEL";
  if (object.kind === "TEXT" || object.kind === "NUMBER") return "KEY_TEXT";
  return "MINI_EXPLANATION";
}

function issue(
  code: ProjectAgentCreativeCompatibilityIssue["code"],
  path: ProjectAgentCreativeCompatibilityIssue["path"],
  message: string,
): ProjectAgentCreativeCompatibilityIssue {
  return { code, path, message };
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function projectAgentCreativeParagraphCompatibilityIssues(
  paragraph: ProjectAgentCreativeParagraphSubmissionV1,
): ProjectAgentCreativeCompatibilityIssue[] {
  const issues: ProjectAgentCreativeCompatibilityIssue[] = [];
  const objectIds = paragraph.objects.map((object) => object.visualObjectId);
  const objectById = new Map(paragraph.objects.map((object) => [object.visualObjectId, object]));
  const mainObjects = paragraph.objects.filter((object) => object.role === "MAIN");
  const main = objectById.get(paragraph.mainVisualObjectId) ?? null;
  const declaredSupportIds = paragraph.supportingVisualObjectIds;
  const actualSupportIds = paragraph.objects.filter((object) => object.role === "SUPPORT").map((object) => object.visualObjectId);

  if (!unique(objectIds)
    || mainObjects.length !== 1
    || main?.role !== "MAIN"
    || mainObjects[0]?.visualObjectId !== paragraph.mainVisualObjectId
    || !unique(declaredSupportIds)
    || declaredSupportIds.includes(paragraph.mainVisualObjectId)
    || actualSupportIds.slice().sort().join("\u0000") !== declaredSupportIds.slice().sort().join("\u0000")) {
    issues.push(issue(
      "PROJECT_AGENT_PARAGRAPH_STRUCTURE_INVALID",
      ["objects"],
      "A creative paragraph must declare exactly one MAIN and the exact unique SUPPORT object set.",
    ));
  }

  if (main !== null && !["REAL_CONTENT", "CONSTRUCTED_INFORMATION"].includes(main.objectClass)) {
    issues.push(issue(
      "PROJECT_AGENT_PARAGRAPH_STRUCTURE_INVALID",
      ["mainVisualObjectId"],
      "MAIN must independently carry information and cannot be guidance or decoration.",
    ));
  }

  const localReferences = [
    ...paragraph.objects.flatMap((object) => object.childObjectIds),
    ...paragraph.composition.readingOrderObjectIds,
    ...paragraph.packagingTargets.map((target) => target.visualObjectId),
    ...paragraph.states.flatMap((state) => state.targetObjectIds),
  ];
  if (localReferences.some((id) => !objectById.has(id))
    || !unique(paragraph.composition.readingOrderObjectIds)
    || !unique(paragraph.packagingTargets.map((target) => target.visualObjectId))
    || !unique(paragraph.states.map((state) => state.stateId))) {
    issues.push(issue(
      "PROJECT_AGENT_PARAGRAPH_STRUCTURE_INVALID",
      ["objects"],
      "Every paragraph reference must resolve locally and repeated reading, target, or state identities are forbidden.",
    ));
  }

  // These semantic collections must contain addressable items. A title or
  // slash-separated sentence cannot stand in for independently timed objects.
  const collectionKinds = new Set<VisualObject["kind"]>(["CARD_SET", "FLOW", "COMPARISON", "LIST", "TIMELINE"]);
  paragraph.objects.forEach((object, index) => {
    const children = object.childObjectIds.map(id => objectById.get(id));
    if (collectionKinds.has(object.kind) && (children.length < 2
      || !unique(object.childObjectIds)
      || children.some(child => !child || child.role !== "INTERNAL"
        || (child.text?.trim().length ?? 0) === 0 && !["EXISTING_ASSET", "REQUIRED_MATERIAL"].includes(child.source.kind)))) {
      issues.push(issue("PROJECT_AGENT_GROUP_CONTENT_MISSING", ["objects", index, "childObjectIds"],
        `${object.kind} ${object.visualObjectId} 必须包含至少两个有实际内容的 INTERNAL 子对象；每项单独提供文字或素材引用。不要把项目用斜杠拼成一行，也不要把设计说明当作画面内容。`));
    }
    const parents = paragraph.objects.filter(candidate => candidate.childObjectIds.includes(object.visualObjectId));
    if (object.role === "INTERNAL" ? parents.length !== 1 || parents[0]?.role === "INTERNAL" : parents.length !== 0) {
      issues.push(issue("PROJECT_AGENT_OBJECT_PARENT_INVALID", ["objects", index],
        `对象 ${object.visualObjectId} 的归属无效：INTERNAL 必须恰好属于一个顶层对象，MAIN/SUPPORT 不能作为子对象。`));
    }
  });

  const targetIds = new Set(paragraph.packagingTargets.map((target) => target.visualObjectId));
  if (paragraph.objects.some((object) =>
    ["DESIGN_REQUIRED", "GUIDANCE", "DECORATIVE"].includes(object.packagingMode)
    && !targetIds.has(object.visualObjectId))) {
    issues.push(issue(
      "PROJECT_AGENT_PARAGRAPH_STRUCTURE_INVALID",
      ["packagingTargets"],
      "Every designed, guidance, or decorative object must be an explicit packaging target.",
    ));
  }

  if (main !== null && directorMainLayoutKind(main.kind) === null) {
    issues.push(issue(
      "PROJECT_AGENT_MAIN_KIND_INVALID",
      ["mainVisualObjectId"],
      `${main.kind} is a scaffold, annotation, or attention primitive and cannot independently carry MAIN information.`,
    ));
  }

  const variant = layoutVariantById(paragraph.composition.selectedVariantId);
  if (variant === null) {
    issues.push(issue(
      "PROJECT_AGENT_LAYOUT_VARIANT_NOT_FOUND",
      ["composition", "selectedVariantId"],
      `The selected layout variant ${paragraph.composition.selectedVariantId} does not exist.`,
    ));
    return issues;
  }

  const relation = sceneRelationCatalogItem(paragraph.informationRelation);
  if (!relation.compatibleLayoutFamilyIds.includes(variant.familyId)) {
    issues.push(issue(
      "PROJECT_AGENT_LAYOUT_RELATION_INCOMPATIBLE",
      ["composition", "selectedVariantId"],
      `${paragraph.informationRelation} is incompatible with layout family ${variant.familyId}; choose one of ${relation.compatibleLayoutFamilyIds.join(", ")}.`,
    ));
  }

  const mappedMainKind = main === null ? null : directorMainLayoutKind(main.kind);
  if (mappedMainKind !== null && !variant.allowedMainKinds.includes(mappedMainKind)) {
    issues.push(issue(
      "PROJECT_AGENT_LAYOUT_MAIN_KIND_INCOMPATIBLE",
      ["composition", "selectedVariantId"],
      `Layout ${variant.variantId} does not accept MAIN kind ${main?.kind ?? "missing"}.`,
    ));
  }

  const supports = declaredSupportIds.map((id) => objectById.get(id)).filter((object): object is VisualObject => object !== undefined);
  if (supports.length !== declaredSupportIds.length
    || supports.length < variant.supportCount.minimum
    || supports.length > variant.supportCount.maximum
    || supports.some((object) => !variant.allowedSupportingKinds.includes(directorSupportingLayoutKind(object)))) {
    issues.push(issue(
      "PROJECT_AGENT_LAYOUT_SUPPORT_INCOMPATIBLE",
      ["supportingVisualObjectIds"],
      `Layout ${variant.variantId} does not accept the declared SUPPORT object set.`,
    ));
  }

  const topLevelIds = [paragraph.mainVisualObjectId, ...declaredSupportIds];
  const mappings = paragraph.composition.objectSlotMappings;
  const mappingByObject = new Map(mappings.map((mapping) => [mapping.visualObjectId, mapping.layoutSlotId]));
  if (mappings.length !== topLevelIds.length
    || !unique(mappings.map((mapping) => mapping.visualObjectId))
    || !unique(mappings.map((mapping) => mapping.layoutSlotId))
    || topLevelIds.some((id) => !mappingByObject.has(id))) {
    issues.push(issue(
      "PROJECT_AGENT_LAYOUT_SLOT_INCOMPATIBLE",
      ["composition", "objectSlotMappings"],
      "Layout mappings must assign MAIN and every SUPPORT exactly once.",
    ));
  } else {
    for (const objectId of topLevelIds) {
      const object = objectById.get(objectId);
      const slotId = mappingByObject.get(objectId);
      const slot = variant.slots.find((candidate) => candidate.slotId === slotId);
      if (object === undefined || slot === undefined) {
        issues.push(issue(
          "PROJECT_AGENT_LAYOUT_SLOT_INCOMPATIBLE",
          ["composition", "objectSlotMappings"],
          `Object ${objectId} is not assigned to a real slot in ${variant.variantId}.`,
        ));
        continue;
      }
      const mappedKind = objectId === paragraph.mainVisualObjectId
        ? directorMainLayoutKind(object.kind)
        : directorSupportingLayoutKind(object);
      if (mappedKind === null || !slot.acceptedKinds.includes(mappedKind)) {
        issues.push(issue(
          "PROJECT_AGENT_LAYOUT_SLOT_INCOMPATIBLE",
          ["composition", "objectSlotMappings"],
          `Object ${objectId} kind ${object.kind} is incompatible with slot ${slot.slotId}.`,
        ));
      }
      if (object.text !== null && slot.textCapacity !== null
        && Array.from(object.text).length > slot.textCapacity.maximumGraphemes) {
        issues.push(issue(
          "PROJECT_AGENT_LAYOUT_TEXT_CAPACITY_EXCEEDED",
          ["objects", paragraph.objects.indexOf(object), "text"],
          `Object ${objectId} has ${Array.from(object.text).length} graphemes but slot ${slot.slotId} supports ${slot.textCapacity.maximumGraphemes}.`,
        ));
      }
    }
  }

  return issues;
}
