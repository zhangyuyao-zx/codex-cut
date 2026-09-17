import {runtimeCommand, whisperModelPath} from "./runtime-paths";
import { Router } from "express";
import { createWriteStream } from "node:fs";
import { mkdir, unlink, access } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { resolve, basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { createRoughcutService, projectCutWords } from "./roughcut-service";
import { transcribeMedia, parseWhisperJson } from "../modules/server/transcription";
export async function roughcutRoutes(dir: string) {
  const service = await createRoughcutService(dir, {
      recoverInterrupted: true,
    }),
    router = Router();
  let transcribing = false,
    transcriptionError = "";
  const state = async () => {
    const s = await service.get();
    return {
      ...s,
      capabilities: {multiAsset: true, clipTransforms: true},
      mappedWords: projectCutWords(s).map((w) => ({
        ...w,
        id: w.sourceId,
      })),
      transcribing,
      transcriptionError,
    };
  };
  router.get("/", async (_req, res) => res.json(await state()));
  router.post("/upload", async (req, res, next) => {
    let temp = "";
    try {
      if (transcribing) throw Error("请等待转写完成");
      if (req.query.mode === 'append' && !Number.isSafeInteger(Number(req.query.expectedRevision))) throw Error('追加素材需要当前工程版本');
      const name = String(req.query.name || "video.mp4");
      if (!/\.(mp4|mov|m4v|webm|mkv)$/i.test(name))
        throw Error("请选择视频文件");
      await mkdir(resolve(dir, "uploads"), { recursive: true });
      temp = resolve(dir, "uploads", randomUUID() + extname(name));
      let bytes = 0;
      const limit = new Transform({
        transform(chunk, _encoding, cb) {
          bytes += chunk.length;
          cb(
            bytes > 4 * 1024 ** 3 ? Error("当前单文件上限为4GB") : null,
            chunk,
          );
        },
      });
      await pipeline(req, limit, createWriteStream(temp, { flags: "wx" }));
      await service.importFile(temp, name, req.query.mode === 'append' ? Number(req.query.expectedRevision) : undefined);
      transcriptionError = "";
      res.json(await state());
    } catch (e) {
      next(e);
    } finally {
      if (temp) await unlink(temp).catch(() => {});
    }
  });
  router.post("/import", async (req, res, next) => {
    try {
      if (transcribing) throw Error("请等待转写完成");
      if (req.body.mode === 'append' && !Number.isSafeInteger(req.body.expectedRevision)) throw Error('追加素材需要当前工程版本');
      await service.importFile(req.body.path, undefined, req.body.mode === 'append' ? req.body.expectedRevision : undefined);
      transcriptionError = "";
      res.json(await state());
    } catch (e) {
      next(e);
    }
  });
  router.post("/ranges", async (req, res, next) => {
    try {
      await service.cut(req.body.expectedRevision, req.body.ranges);
      res.json(await state());
    } catch (e) {
      next(e);
    }
  });
  router.post('/clips', async (req, res, next) => {
    try {
      await service.setClips(req.body.expectedRevision, req.body.clips);
      res.json(await state());
    } catch (e) { next(e); }
  });
  router.post("/undo", async (req, res, next) => {
    try {
      await service.undo(req.body.expectedRevision);
      res.json(await state());
    } catch (e) {
      next(e);
    }
  });
  router.post("/transcript", async (req, res, next) => {
    try {
      const raw = req.body.transcript;
      const words = Array.isArray(raw)
        ? raw
        : parseWhisperJson(raw).words.map((w, i) => ({
            id: "word-" + i,
            text: w.word,
            startMs: w.startMs,
            endMs: w.endMs,
          }));
      if (req.body.assetId) await service.setAssetTranscript(req.body.expectedRevision, req.body.assetId, words);
      else await service.setTranscript(req.body.expectedRevision, words);
      res.json(await state());
    } catch (e) {
      next(e);
    }
  });
  router.post("/transcribe", async (req, res, next) => {
    try {
      if (transcribing) throw Error("本地转写已在运行");
      const s = await service.get();
      if (!s.asset) throw Error("请先导入视频");
      const assetId = req.body.assetId;
      const selectedAsset = s.timeline?.assets.find(a => a.id === assetId);
      if (s.timeline && !selectedAsset) throw Error('请选择要转写的素材');
      await access(whisperModelPath());
      transcribing = true;
      transcriptionError = "";
      res.json({ started: true });
      void (async () => {
        try {
          const result = await transcribeMedia({
            mediaPath: resolve(dir, selectedAsset?.proxyFileName ?? basename(s.asset!.url)),
            model: process.env.WORKBENCH_WHISPER_MODEL || "small",
            command: runtimeCommand("whisper"),
            outputDir: resolve(dir, "transcription"),
            wordTimestamps: true,
          });
          const words = result.words.map((w, i) => ({
              id: "word-" + i,
              text: w.word,
              startMs: w.startMs,
              endMs: w.endMs,
            }));
          if (selectedAsset) await service.setAssetTranscript(s.revision, selectedAsset.id, words);
          else await service.setTranscript(s.revision, words);
        } catch (e) {
          transcriptionError = e instanceof Error ? e.message : String(e);
        } finally {
          transcribing = false;
        }
      })();
    } catch (e) {
      next(e);
    }
  });
  router.post("/render", async (_req, res, next) => {
    try {
      const s = await service.get();
      if (!s.asset) throw Error("请先导入视频");
      if (s.busy) throw Error("预览正在生成");
      res.json({ started: true });
      void service.render().catch((e) => console.error("Roughcut render:", e));
    } catch (e) {
      next(e);
    }
  });
  return Object.assign(router, { isBusy: async () => transcribing || (await service.get()).busy });
}
