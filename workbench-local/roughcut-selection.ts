export interface SelectableWord {
  id: string;
}

export interface TimedRange {
  startMs: number;
  endMs: number;
}

/** Return the inclusive word range between two transcript anchors. */
export function wordIdsBetween(
  words: readonly SelectableWord[],
  anchorId: string,
  focusId: string,
): string[] {
  const anchorIndex = words.findIndex((word) => word.id === anchorId);
  const focusIndex = words.findIndex((word) => word.id === focusId);
  if (anchorIndex < 0 || focusIndex < 0) return [];
  const start = Math.min(anchorIndex, focusIndex);
  const end = Math.max(anchorIndex, focusIndex);
  return words.slice(start, end + 1).map((word) => word.id);
}

/** Expand a range to cover complete 30fps frames before the service snaps it. */
export function expandRangeToFrame(
  range: TimedRange,
  durationMs: number,
  fps = 30,
): TimedRange {
  const frameScale = fps / 1000;
  const frameDurationMs = 1000 / fps;
  return {
    startMs: Math.max(
      0,
      Math.floor(range.startMs * frameScale + 1e-7) * frameDurationMs,
    ),
    endMs: Math.min(
      durationMs,
      Math.ceil(range.endMs * frameScale - 1e-7) * frameDurationMs,
    ),
  };
}

function boundaryNode(node: Node | null): Node | null {
  if (node === null) return null;
  return node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
}

function rangeIntersectsElement(selectionRange: Range, element: HTMLElement): boolean {
  const elementRange = document.createRange();
  elementRange.selectNodeContents(element);
  return (
    selectionRange.compareBoundaryPoints(Range.END_TO_START, elementRange) < 0 &&
    selectionRange.compareBoundaryPoints(Range.START_TO_END, elementRange) > 0
  );
}

/**
 * Map a native DOM text selection to the transcript word ids it crosses.
 * The DOM order is authoritative, so backwards selections remain ordered.
 */
export function wordIdsFromDomSelection(
  root: HTMLElement | null,
  selection: Selection | null,
): string[] {
  if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return [];
  const range = selection.getRangeAt(0);
  const anchor = boundaryNode(selection.anchorNode);
  const focus = boundaryNode(selection.focusNode);
  if (!anchor || !focus || !root.contains(anchor) || !root.contains(focus)) return [];

  return Array.from(root.querySelectorAll<HTMLElement>("[data-word-id]"))
    .filter((element) => rangeIntersectsElement(range, element))
    .map((element) => element.dataset.wordId || "")
    .filter(Boolean);
}
