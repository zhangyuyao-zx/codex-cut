import type {
  RoughCutCandidate,
  RoughCutProposal,
  RoughCutSnapshot,
} from "../../contracts/rough-cut-contract.js";
import type { AgentSnapshot } from "../agent-v2/types.js";
import type { EditorDocumentEnvelope } from "../editor-v2/types.js";

export type { RoughCutCandidate, RoughCutProposal, RoughCutSnapshot };

export interface RoughCutMutationResult {
  snapshot: RoughCutSnapshot;
  editor: EditorDocumentEnvelope;
  proposal: RoughCutProposal;
  agent: AgentSnapshot;
}
