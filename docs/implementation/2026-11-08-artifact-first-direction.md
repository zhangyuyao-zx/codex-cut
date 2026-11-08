# Dots: artifact-first production architecture

The prior default required a complete film action package before the first representative shot could render. It duplicated native beats, code, timing, and review observations across files, while completeness checks could be mistaken for visual quality. This change replaces that default for new Dots projects. It keeps the existing native editor, render identity, soundtrack, user overrides, and approval ledger.

## Responsibilities and flow

- Native production/cut own scene order, timing, design, parameters, soundtrack, and user decisions.
- `authoring.json` schema 2 owns material provenance, applicable references, coarse visual tasks, representative relationships, and actual review observations.
- Scene code owns geometry and behavior. The optional pinned 1.3 state system remains available; there is no mandatory duplicate action-script import.
- `studio capture` derives video identity, frames, and playable reference clips from a completed native render. It creates an unreviewed draft, never a viewing or acceptance claim.
- The author evaluates real output and references. The native ledger separately records the user's acceptance of an exact version.

The path is coarse film → actual materials → representative shot → observed comparison → expansion → adjacent/full-film review. An unrelated coarse scene does not prevent a first representative from rendering. Expansion requires a current observed representative; new kinds of expression can become their own representative. Assembly and delivery preserve existing native approval requirements and require current review evidence.

The gate verifies identities and workflow prerequisites, not taste or the honesty of prose. It reports `technicalValidation` separately from `visualJudgment: not-automatically-assessed`. Merely importing a real image cannot prove that it is visible, relevant, or well composed. Those are actual visual judgments.

## Implementation

- `production-authoring.ts` dispatches saved versions; the former implementation is isolated in `legacy-production-authoring.ts`.
- `production-direction.ts` validates the new record against native scene/module/material identities, render evidence, and reviewed representative dependencies.
- `production-policy.mjs` initializes schema 2 and supplies the common runtime capability version. Existing records are never silently migrated.
- `studio.mjs` supplies sync, asset/reference registration, capture, and resume. Sync preserves authored rows and archives retired rows; writes retain history and reject observed concurrent edits.
- `studio/media.jsx` supplies real-media viewports and source-coordinate focus marks without a default scene layout. The selected crop has its own clipping region, so contain letterboxing does not expose adjacent source content.
- `studio/CRAFT.md` connects expressive tasks to concrete code and actual reference examples. Reference research remains a separate tool.
- WORKFLOW is the single default procedure. Prior source-tool documentation and the v1 protocol are under `legacy/`.
- Plugin status and summary expose actual versus expected runtime capability. They do not restart an active service or claim a running process has loaded updated code.

## Validation

- TypeScript check passed.
- Direction/native route/legacy authoring tests: 15 passed; CLI/capture/native-binding checks: 4 passed. Both saved protocols are covered at native render, approval, and assembly boundaries.
- Plugin tests: 25 passed, 1 intentionally skipped live-mutation check. No mutation test was run against the active user film.
- Skill structure validation passed.
- An independent native project with ten coarse scenes implemented only two representatives. Both rendered through the native API, at 14.4667 and 17.1 seconds. Actual frame inspection found and corrected viewport leakage; subsequent renders verified the correction and source-coordinate annotation.
- Actual native state: both selected design prerequisites valid; author observations incomplete; whole-film assembly not ready; user approvals zero. No playback, audio, artistic acceptance, or full-film success was inferred from these checks.

The private validation project, referenced media, voice, and screenshots are excluded from the public repository. The prototypes still have visual issues and are not promoted into accepted examples. Existing active films, private assets, and pinned release bytes are unchanged.

## Adoption and limits

New project initialization uses schema 2 when the workspace has selected Dots. Existing schema 1 records continue through their saved reader. The plugin source and installed cache must be synchronized separately from server startup; an active old process can continue an existing film. New-workflow capability must be checked before starting another project.

This refactor removes contradictory defaults and duplicated production documents. It makes selected materials and actual comparison easier to execute and harder to confuse with acceptance. It does not promise to automate aesthetic judgment or make a careless author reliable by adding more mandatory text.
