# Third-party notices

Codex Cut includes dependencies installed through npm and component adaptations derived from the projects below. Third-party material remains subject to its original license; the repository-level PolyForm Noncommercial license applies to Codex Cut's original material.

| Project | Pinned revision | License and notice |
|---|---|---|
| [reactvideoeditor/remotion-templates](https://github.com/reactvideoeditor/remotion-templates) | `6209b724798e48ff395f8df1a6fa2d26082372b5` | README declares MIT; no standalone LICENSE file was present at this revision. |
| [lifeprompt-team/remotion-scenes](https://github.com/lifeprompt-team/remotion-scenes) | `02c7a84241da7010b5f59c420b0110aafd1d6f0d` | MIT. Copyright (c) 2026 lifeprompt-team. |
| [Curvable/motion](https://github.com/Curvable/motion) | `48aa412b5f4a15d5a31fe02f6e7e43e654ca091a` | MIT. Copyright (c) 2026 Curvable. |
| [jessai2026/remotion-playground](https://github.com/jessai2026/remotion-playground) | `fe10b866da07c5799b226d7ff9598c1dc35d7159` | Repository LICENSE: MIT, Copyright (c) 2025 Remotion Playground. The package metadata says ISC; Codex Cut retains the more conservative repository notice. |
| [Three.js](https://github.com/mrdoob/three.js) | npm `three@0.186.1` | MIT. Original license installed with the package. |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | npm `@react-three/fiber@9.8.2` | MIT. Original license installed with the package. |

`@remotion/three@4.0.489` follows Remotion's own license, like the existing Remotion runtime. The original continuous-scene example uses Three.js mathematics and SVG; it does not copy animation code or assets from the projects reviewed during research.

## MIT License text

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The npm dependencies and their license metadata are recorded by `package-lock.json`; their own license files are installed with those packages by `npm ci`.

## Editor upgrade (0.3.0)

The editor upgrade studies OpenFilm’s interaction and architecture as a reference. It does not vendor OpenFilm source, video assets, or a new rendering engine. Rendering continues to use the existing pinned Remotion stack. No additional npm runtime dependency is introduced by this upgrade.
