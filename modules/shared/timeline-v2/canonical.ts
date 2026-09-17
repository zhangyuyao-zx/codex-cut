import type { TimelineDocumentV2 } from "./schema.js";

export function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0) ?? 0);
  const commonLength = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < commonLength; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return leftPoints.length - rightPoints.length;
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function compareNullableStrings(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return -1;
  }
  if (right === null) {
    return 1;
  }
  return compareUnicodeCodePoints(left, right);
}

function sortIds(values: string[]): void {
  values.sort(compareUnicodeCodePoints);
}

/**
 * Returns a detached document whose normative arrays use the Phase 1 ordering.
 * It intentionally does not deduplicate set-like arrays: duplicate identities
 * remain visible to the invariant validator instead of being silently repaired.
 */
export function normalizeTimelineDocumentV2(document: TimelineDocumentV2): TimelineDocumentV2 {
  const normalized = structuredClone(document);

  normalized.assets.sort((left, right) => compareUnicodeCodePoints(left.assetId, right.assetId));
  normalized.lanes.sort(
    (left, right) => compareNumbers(left.order, right.order) || compareUnicodeCodePoints(left.laneId, right.laneId),
  );
  const laneOrder = new Map(normalized.lanes.map((lane) => [lane.laneId, lane.order]));
  normalized.clips.sort(
    (left, right) =>
      compareNumbers(laneOrder.get(left.laneId) ?? Number.MAX_SAFE_INTEGER, laneOrder.get(right.laneId) ?? Number.MAX_SAFE_INTEGER) ||
      compareNumbers(left.timelineRange.startFrame, right.timelineRange.startFrame) ||
      compareNumbers(left.timelineRange.endFrame, right.timelineRange.endFrame) ||
      compareUnicodeCodePoints(left.clipId, right.clipId),
  );

  const clipsById = new Map(normalized.clips.map((clip) => [clip.clipId, clip]));
  normalized.programSpine.entries.sort((left, right) => {
    const leftClip = clipsById.get(left.clipId);
    const rightClip = clipsById.get(right.clipId);
    return (
      compareNumbers(leftClip?.timelineRange.startFrame ?? Number.MAX_SAFE_INTEGER, rightClip?.timelineRange.startFrame ?? Number.MAX_SAFE_INTEGER) ||
      compareNumbers(leftClip?.timelineRange.endFrame ?? Number.MAX_SAFE_INTEGER, rightClip?.timelineRange.endFrame ?? Number.MAX_SAFE_INTEGER) ||
      compareUnicodeCodePoints(left.clipId, right.clipId) ||
      compareUnicodeCodePoints(left.entryId, right.entryId)
    );
  });
  normalized.markers?.sort(
    (left, right) =>
      compareNumbers(left.frame, right.frame) ||
      compareUnicodeCodePoints(left.markerId, right.markerId),
  );

  normalized.captionCues.sort(
    (left, right) =>
      compareNumbers(left.startMs, right.startMs) ||
      compareNumbers(left.endMs, right.endMs) ||
      compareUnicodeCodePoints(left.captionCueId, right.captionCueId),
  );
  sortIds(normalized.captionSuppressions);
  normalized.semanticCues.sort(
    (left, right) =>
      compareNumbers(left.timelineRange.startFrame, right.timelineRange.startFrame) ||
      compareNumbers(left.timelineRange.endFrame, right.timelineRange.endFrame) ||
      compareUnicodeCodePoints(left.semanticCueId, right.semanticCueId),
  );
  for (const semanticCue of normalized.semanticCues) {
    sortIds(semanticCue.captionCueIds);
  }

  normalized.transitionEdges.sort(
    (left, right) =>
      compareUnicodeCodePoints(left.adjacencyScope, right.adjacencyScope) ||
      compareNullableStrings(left.laneId, right.laneId) ||
      compareUnicodeCodePoints(left.fromClipId, right.fromClipId) ||
      compareUnicodeCodePoints(left.toClipId, right.toClipId) ||
      compareUnicodeCodePoints(left.transitionEdgeId, right.transitionEdgeId),
  );
  for (const transition of normalized.transitionEdges) {
    transition.compatibility.reasons.sort(compareUnicodeCodePoints);
  }

  normalized.packagingGroups.sort(
    (left, right) =>
      compareNumbers(left.timelineRange.startFrame, right.timelineRange.startFrame) ||
      compareNumbers(left.timelineRange.endFrame, right.timelineRange.endFrame) ||
      compareUnicodeCodePoints(left.packagingGroupId, right.packagingGroupId),
  );
  for (const group of normalized.packagingGroups) {
    sortIds(group.semanticCueIds);
    sortIds(group.memberClipIds);
    sortIds(group.memberCaptionCueIds);
    sortIds(group.memberTransitionEdgeIds);
    if (group.captionAvoidance) {
      sortIds(group.captionAvoidance.captionCueIds);
    }
  }

  if (normalized.legacy) {
    normalized.legacy.sourcePresencePointers.sort(compareUnicodeCodePoints);
    normalized.legacy.identityMappings.derivedIdMappings.sort(
      (left, right) =>
        compareUnicodeCodePoints(left.source, right.source) ||
        compareUnicodeCodePoints(left.target, right.target) ||
        compareUnicodeCodePoints(left.reason, right.reason),
    );
    normalized.legacy.trackMappings.sort(
      (left, right) =>
        compareNumbers(laneOrder.get(left.laneId) ?? Number.MAX_SAFE_INTEGER, laneOrder.get(right.laneId) ?? Number.MAX_SAFE_INTEGER) ||
        compareUnicodeCodePoints(left.laneId, right.laneId),
    );
    sortIds(normalized.legacy.legacyPackaging.clipIds);
  }

  return normalized;
}

function canonicalizeValue(value: unknown, ancestors: Set<object>): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("canonical JSON does not permit non-finite numbers");
    }
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`canonical JSON does not permit ${typeof value}`);
  }
  if (ancestors.has(value)) {
    throw new TypeError("canonical JSON does not permit cycles");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalizeValue(entry, ancestors)).join(",")}]`;
    }
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort(compareUnicodeCodePoints);
    const entries = keys.map((key) => {
      if (object[key] === undefined) {
        throw new TypeError("canonical JSON does not permit undefined object values");
      }
      return `${JSON.stringify(key)}:${canonicalizeValue(object[key], ancestors)}`;
    });
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  return canonicalizeValue(value, new Set());
}

const sha256RoundConstants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/** A dependency-free SHA-256 used by both browser-safe Domain code and Node persistence. */
export function sha256(input: string | Uint8Array): string {
  const source = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const bitLength = source.length * 8;
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(source);
  bytes[source.length] = 0x80;
  const dataView = new DataView(bytes.buffer);
  const highBits = Math.floor(bitLength / 0x1_0000_0000);
  const lowBits = bitLength >>> 0;
  dataView.setUint32(paddedLength - 8, highBits, false);
  dataView.setUint32(paddedLength - 4, lowBits, false);

  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const schedule = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = dataView.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = schedule[index - 15]!;
      const previous2 = schedule[index - 2]!;
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      schedule[index] = (schedule[index - 16]! + sigma0 + schedule[index - 7]! + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const bigSigma1 = rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choose = (e! & f!) ^ (~e! & g!);
      const temporary1 = (h! + bigSigma1 + choose + sha256RoundConstants[index]! + schedule[index]!) >>> 0;
      const bigSigma0 = rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temporary2 = (bigSigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    state[0] = (state[0]! + a!) >>> 0;
    state[1] = (state[1]! + b!) >>> 0;
    state[2] = (state[2]! + c!) >>> 0;
    state[3] = (state[3]! + d!) >>> 0;
    state[4] = (state[4]! + e!) >>> 0;
    state[5] = (state[5]! + f!) >>> 0;
    state[6] = (state[6]! + g!) >>> 0;
    state[7] = (state[7]! + h!) >>> 0;
  }

  const hex = state.map((value) => value.toString(16).padStart(8, "0")).join("");
  return `sha256:${hex}`;
}

export function canonicalHash(value: unknown): string {
  return sha256(canonicalJson(value));
}

export function canonicalTimelineDocumentV2(document: TimelineDocumentV2): string {
  return canonicalJson(normalizeTimelineDocumentV2(document));
}
