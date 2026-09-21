import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {bundle} from "@remotion/bundler";
import {renderMedia, selectComposition} from "@remotion/renderer";
import {remotionRuntime} from "../workbench-local/runtime-paths";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "assets/readme");
const outputLocation = resolve(outputDir, "runtime-demo.mp4");
const serveUrl = await bundle({
  entryPoint: resolve(root, "workbench-local/readme-demo-entry.tsx"),
  publicDir: resolve(root, "public"),
  outDir: resolve(root, ".cache/readme-demo-bundle"),
  webpackOverride: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      extensionAlias: {
        ...config.resolve?.extensionAlias,
        ".js": [".js", ".ts", ".tsx"],
      },
    },
  }),
});

await mkdir(outputDir, {recursive: true});
const runtime = remotionRuntime(root);
const composition = await selectComposition({
  serveUrl,
  id: "CodexCutReadmeDemo",
  ...runtime,
});

await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  muted: true,
  outputLocation,
  concurrency: 2,
  ...runtime,
  onProgress: ({progress}) => {
    process.stdout.write(`\rRendering README demo ${Math.round(progress * 100)}%`);
  },
});
process.stdout.write(`\n${outputLocation}\n`);
