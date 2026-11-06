# Dots 1.2.0 rhythm gate

Previously, an author could label every interval between short cue animations as a reading hold. Structural coverage then reported no gaps even when the rendered subject remained unchanged. This release keeps action gaps visible regardless of hold declarations and separates design checks from rendered evidence.

- New holds identify the visible content, viewer task, exit condition and purpose. Generic generated waiting reasons fail checking.
- `audit-render` decodes the actual local movie at 6 fps and checks author-specified semantic regions. Compression noise, small pulses, and excluded subtitles/timers do not hide static subjects. The 2.5-second threshold is a review locator, not a maximum permissible hold.
- `gate-render` binds the audit and observations to both video and scene SHA-256. Every detected interval remains in its output. An unexplained interval, missing normal-speed observation, stale evidence, or outstanding rework blocks delivery.
- An intentional pause can pass after a specific authored reading task and actual observation. Pixel change alone never proves meaning, quality, or user acceptance.
- Existing 1.0.0/1.1.0 source remains immutable. New initialization pins 1.2.0; previous projects do not migrate automatically.

Validation: 11 targeted rhythm regressions plus the existing 32 compatibility and authoring checks. Real project evidence is kept in its private production directory, not this repository. The local failed-movie regression exposes long static subject intervals that structural checks had previously accepted.

```sh
node tools/dots-production/test-rhythm.mjs
npm run dots -- audit-render --video MOVIE --scene SCENE --out AUDIT
npm run dots -- gate-render --video MOVIE --scene SCENE --audit AUDIT --review OBSERVATIONS --out GATE
```

Authoring must design what happens between cues. Do not stretch an action's declared duration, add decorative motion, or generate reading justifications to satisfy the gate. Review actual neighboring states and the complete segment at normal speed. This gate is production evidence, not a new user approval flow.
