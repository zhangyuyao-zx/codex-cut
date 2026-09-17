# Component reference attribution

This folder contains the generated component index and attribution record. Eligible source is vendored locally under `src/vendor/upstream/` at the pinned commits listed below; `library.json` marks only entries with a generated static renderer as `executable: true`. Excluded entries retain an explicit `installStatus` and reason and continue through the Codex adaptation/original fallback. No runtime GitHub import is used.

| Source | Entries | License note |
| --- | ---: | --- |
| [reactvideoeditor/remotion-templates](https://github.com/reactvideoeditor/remotion-templates) | 81 (76 installed / 5 fallback) | README-declared MIT at `6209b724798e48ff395f8df1a6fa2d26082372b5`; no standalone LICENSE file |
| [lifeprompt-team/remotion-scenes](https://github.com/lifeprompt-team/remotion-scenes) | 201 (192 installed / 9 fallback) | MIT at `02c7a84241da7010b5f59c420b0110aafd1d6f0d`; local system-font compatibility patch |
| [Curvable/motion](https://github.com/Curvable/motion) | 14 (10 installed / 4 fallback) | MIT at `48aa412b5f4a15d5a31fe02f6e7e43e654ca091a` |
| [jessai2026/remotion-playground](https://github.com/jessai2026/remotion-playground) | 38 (28 installed / 10 fallback) | Repository LICENSE MIT at `fe10b866da07c5799b226d7ff9598c1dc35d7159`; package.json says ISC, so attribution is conservative |

The 24 curated direct-use components remain local workbench adaptations (Curvable, Playground audio examples, and Workbench originals) and are separate from the generated installed-source registry. Playground audio examples use deterministic synthetic preview data and are labelled accordingly; they are not claims of linked audio analysis.
