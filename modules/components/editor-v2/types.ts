import type {
  CaptionCueV2,
  LaneV2,
  PackagingGroupV2,
  PresentationV2,
  TimelineClipV2,
  TimelineDocumentV2,
  TransitionEdgeV2,
} from "../../shared/timeline-v2/schema.js";
import type { EditorAction } from "../../contracts/editor-contract.js";

export type {
  CaptionCueV2,
  EditorAction,
  LaneV2,
  PackagingGroupV2,
  PresentationV2,
  TimelineClipV2,
  TimelineDocumentV2,
  TransitionEdgeV2,
};

export interface EditorDocumentEnvelope {
  document: TimelineDocumentV2;
  documentHash: string;
  revision: number;
  history: {
    undoDepth: number;
    redoDepth: number;
  };
  commit: null | {
    kind: "transaction" | "undo" | "redo";
    transactionId: string;
    idempotent: boolean;
  };
}

export type EditorSelection =
  | { kind: "clip"; id: string }
  | { kind: "lane"; id: string }
  | { kind: "caption"; id: string }
  | { kind: "transition"; id: string }
  | { kind: "group"; id: string }
  | null;

export type PreviewAspect = "landscape" | "portrait" | "square";

export interface MigrationPreview {
  schemaVersion: 1;
  sourceName: string;
  status: "migrated" | "failed";
  report: {
    contractId: string;
    sourceDocumentHash: string;
    targetDocumentHash: string | null;
    identitySummary: Record<string, number>;
    diagnostics: Array<{ severity: string; code: string; path: string | null }>;
  };
  documentSummary: null | {
    name: string;
    projectId: string;
    timelineId: string;
    durationFrames: number;
    laneCount: number;
    clipCount: number;
    captionCount: number;
    legacyPreserved: boolean;
  };
  wroteDestination: false;
}

export interface TransitionCandidate {
  key: string;
  label: string;
  adjacencyScope: "program_spine" | "lane";
  laneId: string | null;
  fromClipId: string;
  toClipId: string;
}
