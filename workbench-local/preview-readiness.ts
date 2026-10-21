type PreviewContext = {
  plan?: { revision?: number; source?: {assetUrl?: string; cutRevision?: number} | null };
  cut?: {
    revision?: number;
    asset?: {url?: string} | null;
    preview?: {url?: string; revision?: number; provenance?: unknown} | null;
    error?: string;
  };
  resolved?: {stale?: boolean; issues?: string[]};
};

/** Plan revisions alone do not identify the cut used to build a scoped response. */
export function productionContextIdentityMatches(current?: PreviewContext, scoped?: PreviewContext) {
  return Boolean(current && scoped &&
    typeof current.plan?.revision === "number" &&
    current.plan.revision === scoped.plan?.revision &&
    typeof current.cut?.revision === "number" &&
    current.cut.revision === scoped.cut?.revision &&
    current.cut.asset?.url && current.cut.asset.url === scoped.cut?.asset?.url &&
    current.plan.source?.assetUrl === scoped.plan?.source?.assetUrl &&
    current.plan.source?.cutRevision === scoped.plan?.source?.cutRevision);
}

export type ScenePreviewReadiness =
  | {ready: true; mediaUrl: string}
  | {ready: false; kind: "waiting" | "error"; message: string};

export function scenePreviewReadiness(current?: PreviewContext, scoped?: PreviewContext): ScenePreviewReadiness {
  if (!productionContextIdentityMatches(current, scoped))
    return {ready: false, kind: "waiting", message: "正在同步当前段落与粗剪，请稍候…"};
  for (const context of [current!, scoped!]) {
    const {cut, plan, resolved} = context;
    if (!plan?.source || plan.source.assetUrl !== cut?.asset?.url)
      return {ready: false, kind: "error", message: "制作方案与当前素材不一致，请为当前素材更新方案。"};
    if (plan.source.cutRevision !== cut?.revision || resolved?.stale)
      return {ready: false, kind: "error", message: "粗剪已变化，请先同步并检查段落。"};
    if (resolved?.issues?.length)
      return {ready: false, kind: "error", message: resolved.issues.join("\n")};
    if (cut?.error)
      return {ready: false, kind: "error", message: "粗剪预览暂不可用：" + cut.error};
    if (!cut?.preview?.url || cut.preview.revision !== cut.revision)
      return {ready: false, kind: "waiting", message: "当前粗剪的连续预览尚未就绪，请在剪辑页生成后继续。"};
  }
  const currentPreview = current!.cut!.preview!;
  const scopedPreview = scoped!.cut!.preview!;
  if (currentPreview.url !== scopedPreview.url ||
    JSON.stringify(currentPreview.provenance) !== JSON.stringify(scopedPreview.provenance))
    return {ready: false, kind: "waiting", message: "粗剪预览已更新，正在同步当前段落…"};
  return {ready: true, mediaUrl: currentPreview.url!};
}
