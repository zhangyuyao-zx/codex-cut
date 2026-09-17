import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { COMPONENT_LIBRARY } from "../modules/components/component-library";
import { createComponentFavoritesStore } from "./component-favorites";
import { createComponentLibrary } from "./component-library";

async function withTempFavorites<T>(
  callback: (root: string, filePath: string) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-cut-component-favorites-"));
  const filePath = path.join(root, "component-favorites.json");
  try {
    return await callback(root, filePath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("component favorites persistence", () => {
  it("persists favorites across store instances with an atomic versioned envelope", async () => {
    await withTempFavorites(async (_root, filePath) => {
      const allowedIds = ["component:a", "component:b"];
      const store = createComponentFavoritesStore(filePath, allowedIds);
      expect(await store.list()).toEqual([]);
      expect(await store.set({ componentId: "component:b", favorite: true })).toEqual([
        "component:b",
      ]);
      expect(await store.set({ componentId: "component:a", favorite: true })).toEqual([
        "component:a",
        "component:b",
      ]);

      const reopened = createComponentFavoritesStore(filePath, allowedIds);
      expect(await reopened.list()).toEqual(["component:a", "component:b"]);
      expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
        schemaVersion: 1,
        componentIds: ["component:a", "component:b"],
      });
    });
  });

  it("validates IDs and mutation shape before writing, and serializes concurrent updates", async () => {
    await withTempFavorites(async (root, filePath) => {
      const store = createComponentFavoritesStore(
        filePath,
        ["component:a", "component:b"],
      );
      await store.set({ componentId: "component:a", favorite: true });
      const before = await readFile(filePath, "utf8");

      await expect(
        store.set({ componentId: "component:unknown", favorite: true }),
      ).rejects.toThrow("不在 App 最终盘点库");
      await expect(
        store.set({ componentId: "component:a", favorite: "yes" }),
      ).rejects.toThrow("收藏参数无效");
      await expect(
        store.set({ componentId: "component:a", favorite: false, extra: true }),
      ).rejects.toThrow("收藏参数无效");
      expect(await readFile(filePath, "utf8")).toBe(before);

      await Promise.all([
        store.set({ componentId: "component:a", favorite: false }),
        store.set({ componentId: "component:b", favorite: true }),
      ]);
      expect(await store.list()).toEqual(["component:b"]);
      expect((await readdir(root)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    });
  });

  it("accepts every one of the 194 current component IDs", async () => {
    await withTempFavorites(async (_root, filePath) => {
      const ids = COMPONENT_LIBRARY.map((entry) => entry.componentId);
      expect(ids).toHaveLength(194);
      const store = createComponentFavoritesStore(filePath, ids);
      const lastId = ids[ids.length - 1];
      expect(await store.set({ componentId: lastId, favorite: true })).toEqual([
        lastId,
      ]);
    });
  });

  it("exposes validated favorites through the library router and reloads them", async () => {
    await withTempFavorites(async (root) => {
      const presetDir = path.join(root, "library-presets");
      const first = await createComponentLibrary(root, presetDir);
      const app = express();
      app.use(express.json());
      app.use(first.router);
      const componentId = COMPONENT_LIBRARY[0].componentId;

      const initial = await request(app).get("/").expect(200);
      expect(initial.body.items).toHaveLength(194);
      expect(initial.body.favorites).toEqual([]);

      const saved = await request(app)
        .post("/favorites")
        .send({ componentId, favorite: true })
        .expect(200);
      expect(saved.body.favorites).toContain(componentId);

      const restarted = await createComponentLibrary(root, presetDir);
      const restartedApp = express();
      restartedApp.use(express.json());
      restartedApp.use(restarted.router);
      const reloaded = await request(restartedApp).get("/").expect(200);
      expect(reloaded.body.favorites).toEqual([componentId]);

      await request(restartedApp)
        .post("/favorites")
        .send({ componentId: "old-research-id", favorite: true })
        .expect(500);
    });
  });
});
