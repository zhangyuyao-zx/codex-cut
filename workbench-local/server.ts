import {remotionRuntime, runtimeCommand} from "./runtime-paths";
import express from "express";
import { createServer } from "vite";
import { resolve } from "node:path";
import { mkdir, copyFile, readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createComponentLibrary } from "./component-library";
import { productionRoutes } from "./production-routes";
import { roughcutRoutes } from "./roughcut-routes";
import { ProjectStore } from "./project-store";
import {checkpointRoutes} from './checkpoint-routes';
const root = process.cwd(),
  dir = resolve(process.env.WORKBENCH_PROJECT_DIR || resolve(root, "projects/local-workbench")),
  media = resolve(dir, "media");
await mkdir(media, { recursive: true });
// A new project must start without reaching into another user's demo directory.
// Legacy animation-lab assets are optional; imported project media remains explicit.
let base: any = {words: [], wave: []};
try { base = JSON.parse(await readFile(resolve(media, "props.json"), "utf8")); }
catch (error: any) { if (error.code !== "ENOENT") throw error; }
const store = await ProjectStore.open(dir, {
    id: "accepted-sample",
    name: "从口播到时间线",
  }),
  token = randomBytes(24).toString("hex");
const app = express(),
  port = Number(process.env.WORKBENCH_PORT || 4340);
// Acquire exclusive ownership before recovering a previous process's task state.
let ready = false, stopping = false;
app.get("/api/health", (_req, res) => res.status(ready ? 200 : 503).json({
  appId: "codex-local-video-workbench", root, pid: process.pid, ready,
}));
app.use((_req, res, next) =>
  ready ? next() : res.status(503).json({ error: "工作台正在启动或停止，请稍后重新打开" }),
);
let listener: ReturnType<typeof app.listen>;
await new Promise<void>((done, reject) => {
  listener = app.listen(port, "127.0.0.1", (error) =>
    error ? reject(error) : done(),
  );
  listener.once("error", reject);
});

app.use((req, res, next) => {
  if (req.headers["sec-fetch-site"] === "cross-site") {
    res.status(403).json({ error: "Cross-site access denied" });
    return;
  }
  if (req.headers.host !== `127.0.0.1:${port}`) {
    res.status(403).json({ error: "Invalid host" });
    return;
  }
  if (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${port}`) {
    res.status(403).json({ error: "Invalid origin" });
    return;
  }
  next();
});
app.use(express.json({ limit: "5mb" }));
app.get("/api/bootstrap", async (_req, res) =>
  res.json({ token, project: await store.get(), base, job, capabilities:{checkpoints:true} }),
);
let activeMutations=0;
app.use("/api", (req, res, next) => {
  if (req.method !== "GET" && req.headers["x-workbench-token"] !== token) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }
  if (req.method !== 'GET' && checkpoints.isBusy()) {
    res.status(409).json({error:'正在备份、校验或恢复，请等待完成后再修改工程'});
    return;
  }
  if(req.method!=='GET' && !req.path.startsWith('/checkpoints/')) {
    activeMutations++;
    let released=false;
    const release=()=>{if(!released){released=true;activeMutations--;}};
    res.once('finish',release);res.once('close',release);
  }
  next();
});
const library = await createComponentLibrary(root, resolve(dir, "library-presets"));
app.use("/api/library", library.router);
const production = await productionRoutes(root, dir, library);
app.use("/api/production", production);
app.use(express.static(resolve(root, "public"), {index:false}));
app.use("/production-media", express.static(resolve(dir, "production")));
const cut = await roughcutRoutes(resolve(dir, "cut"));
app.use("/api/cut", cut);
app.use("/cut-media", express.static(resolve(dir, "cut")));
const checkpoints=checkpointRoutes({repo:root,project:dir,assertIdle:async()=>{
  if(activeMutations) throw Error('工程操作尚未完成，请稍后再备份');
  if(job?.status==='rendering' || await cut.isBusy()) throw Error('剪辑或转写正在处理，请完成后再备份');
  await production.assertCheckpointReady();
}});
app.use('/api/checkpoints',checkpoints);
app.get("/api/project", async (_req, res) => res.json(await store.get()));
app.post("/api/patch", async (req, res, next) => {
  try {
    res.json(
      await store.patch(
        req.body.expectedRevision,
        req.body.patch,
        req.body.actor === "codex" ? "codex" : "user",
      ),
    );
  } catch (e) {
    next(e);
  }
});
for (const method of ["undo", "redo"] as const)
  app.post("/api/" + method, async (req, res, next) => {
    try {
      res.json(await store[method](req.body.expectedRevision));
    } catch (e) {
      next(e);
    }
  });
let job: any = null;
try {
  job = JSON.parse(await readFile(resolve(dir, "last-export.json"), "utf8"));
  if (job.status === "rendering") {
    job = {...job, status: "failed", error: "上次动画实验导出已中断，可重新导出。"};
    await writeFile(resolve(dir, "last-export.json"), JSON.stringify(job));
  }
} catch {}

app.get("/api/export", (_req, res) => res.json(job));
app.post("/api/export", async (_req, res, next) => {
  try {
    if (job?.status === "rendering") {
      res.json(job);
      return;
    }
    const project = await store.get();
    job = { status: "rendering", revision: project.revision, progress: 0 };
    res.json(job);
    void render(project).catch((e) => {
      console.error(e);
      job = {
        ...job,
        status: "failed",
        error: "导出未完成，请重试；详细原因已记录在工作台终端。",
      };
    });
  } catch (e) {
    next(e);
  }
});
async function render(project: any) {
  const { bundle } = await import("@remotion/bundler");
  const { selectComposition, renderMedia } = await import("@remotion/renderer");
  const out = resolve(dir, "exports");
  await mkdir(out, { recursive: true });
  const serveUrl = await bundle({
    entryPoint: resolve(root, "workbench-local/render-entry.tsx"),
    publicDir: media,
  });
  const runtime = remotionRuntime(root);
  const inputProps = {
    ...base,
    values: project.values,
    motion: project.motion,
  };
  const composition = await selectComposition({
    serveUrl,
    id: "Sample",
    inputProps,
    ...runtime,
  });
  const filename = `sample-r${project.revision}-${Date.now()}.mp4`;
  const picture = resolve(out, ".picture-" + filename);
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    outputLocation: picture,
    muted: true,
    concurrency: 2,
    ...runtime,
    onProgress: (p) => {
      job.progress = p.progress;
    },
  });
  await promisify(execFile)(runtimeCommand("ffmpeg"), [
    "-v",
    "error",
    "-i",
    picture,
    "-i",
    resolve(media, "narration.m4a"),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c",
    "copy",
    "-t",
    String(341 / 30),
    "-movflags",
    "+faststart",
    resolve(out, filename),
  ]);
  job = { ...job, status: "done", progress: 1, url: "/exports/" + filename };
  await writeFile(
    resolve(out, filename + ".json"),
    JSON.stringify({ project, inputProps }, null, 2),
  );
  await writeFile(resolve(dir, "last-export.json"), JSON.stringify(job));
}
app.post("/api/shutdown", async (_req, res, next) => {
  try {
    if (job?.status === "rendering" || await cut.isBusy())
      throw Error("粗剪、转写或动画实验仍在处理，请完成后再停止服务");
    res.json({stopping: true});
    void shutdown().then(() => process.exit(0)).catch(e => console.error(e));
  } catch (e) { next(e); }
});

app.use("/exports", express.static(resolve(dir, "exports")));
app.use(express.static(media));
app.use((err: any, _req: any, res: any, _next: any) =>
  res.status(409).json({ error: err.message }),
);
const vite = await createServer({
  optimizeDeps: {include: ["react/jsx-runtime", "react/jsx-dev-runtime"]},
  configFile: false,
  root: resolve(root, "workbench-local"),
  server: { middlewareMode: true, hmr: {port: port + 20000}, fs: {allow:[root]} },
  appType: "spa",
});
app.use(vite.middlewares);
ready = true;
console.log(`Workbench http://127.0.0.1:${port}`);

async function shutdown() {
  if (stopping) return;
  stopping = true;
  ready = false;
  await checkpoints.waitForIdle();
  await production.shutdown();
  await vite.close();
  listener.closeIdleConnections();
  await new Promise<void>(done => listener.close(() => done()));
}
