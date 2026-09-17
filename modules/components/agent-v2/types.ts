import type {
  AgentSessionV2,
  AgentSnapshot,
  AgentTurnRecord,
  ProviderDescriptor,
  RoutedProviderEvent,
  TimelinePatchProposal,
} from "../../contracts/agent-contract.js";
import type { EditorDocumentEnvelope } from "../editor-v2/types.js";

export type {
  AgentSessionV2,
  AgentSnapshot,
  AgentTurnRecord,
  ProviderDescriptor,
  RoutedProviderEvent,
  TimelinePatchProposal,
};

export interface AgentSelectionSummary {
  selectedLaneIds: string[];
  selectedClipIds: string[];
  selectedPackagingGroupIds: string[];
  range: null | {
    startFrame: number;
    endFrame: number;
  };
  truncated: false;
}

export interface AgentMutationResult {
  snapshot: AgentSnapshot;
  editor: EditorDocumentEnvelope;
  proposal: TimelinePatchProposal | null;
}

export type AgentRevisionState = "unstarted" | "current" | "stale";
