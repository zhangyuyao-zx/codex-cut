import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  APP_ID,
  LauncherError,
  parseArgs,
  startWorkbench,
  statusWorkbench,
  stopWorkbench,
} from "./launcher.mjs";

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryRoot() {
  const directory = await mkdtemp(join(tmpdir(), "codex-local-workbench-launcher-"));
  tempDirs.push(directory);
  return directory;
}

async function listen(server, port = 0) {
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolvePromise) => server.close(() => resolvePromise()));
}

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(payload);
}

async function mockWorkbench({ root, ready = true, pid = process.pid, token = "test-token", port = 0 } = {}) {
  const state = { ready, pid, root, token, shutdownHeaders: [], shutdowns: 0 };
  let server;
  server = createServer((request, response) => {
    if (request.url === "/api/health" && request.method === "GET") {
      json(response, state.ready ? 200 : 503, {
        appId: APP_ID,
        root: state.root,
        pid: state.pid,
        ready: state.ready,
      });
      return;
    }
    if (request.url === "/api/bootstrap" && request.method === "GET") {
      json(response, 200, { token: state.token });
      return;
    }
    if (request.url === "/api/shutdown" && request.method === "POST") {
      state.shutdownHeaders.push(request.headers["x-workbench-token"]);
      if (request.headers["x-workbench-token"] !== state.token) {
        json(response, 403, { error: "Invalid token" });
        return;
      }
      state.shutdowns += 1;
      state.ready = false;
      json(response, 200, { stopping: true });
      setImmediate(() => void close(server));
      return;
    }
    json(response, 404, { error: "not found" });
  });
  const baseUrl = await listen(server, port);
  return { baseUrl, state, server };
}

async function freeBaseUrl() {
  const server = createServer();
  const baseUrl = await listen(server);
  await close(server);
  return baseUrl;
}

describe("local workbench launcher", () => {
  it("accepts only the three commands and supports --no-open in either position", () => {
    assert.deepEqual(parseArgs([]), { command: "start", noOpen: false });
    assert.deepEqual(parseArgs(["--no-open"]), { command: "start", noOpen: true });
    assert.deepEqual(parseArgs(["status", "--no-open"]), { command: "status", noOpen: true });
    assert.deepEqual(parseArgs(["--no-open", "stop"]), { command: "stop", noOpen: true });
    assert.throws(() => parseArgs(["restart"]), (error) => error instanceof LauncherError && error.code === "INVALID_ARGUMENT");
  });

  it("reports a matching ready service without starting another process", async () => {
    const root = await temporaryRoot();
    const mock = await mockWorkbench({ root });
    try {
      const result = await statusWorkbench({ root, baseUrl: mock.baseUrl });
      assert.equal(result.state, "running");
      assert.equal(result.pid, process.pid);
    } finally {
      await close(mock.server);
    }
  });

  it("rejects a foreign service and never invokes the launcher process", async () => {
    const root = await temporaryRoot();
    const foreignRoot = resolve(root, "other-repo");
    const mock = await mockWorkbench({ root: foreignRoot });
    let spawned = false;
    try {
      await assert.rejects(
        startWorkbench({
          root,
          baseUrl: mock.baseUrl,
          noOpen: true,
          spawnImpl: () => {
            spawned = true;
            throw new Error("should not spawn");
          },
        }),
        (error) => error instanceof LauncherError && error.code === "FOREIGN_SERVICE",
      );
      assert.equal(spawned, false);
    } finally {
      await close(mock.server);
    }
  });

  it("starts through a detached local tsx command after acquiring its own lock", async () => {
    const root = await temporaryRoot();
    const runtimeDir = join(root, "projects/local-workbench/runtime");
    const tsxPath = join(root, "node_modules/tsx/dist/cli.mjs");
    const baseUrl = await freeBaseUrl();
    const port = Number(new URL(baseUrl).port);
    const calls = [];
    let mock;
    const child = new EventEmitter();
    child.pid = process.pid;
    child.unref = () => calls.push({ type: "unref" });
    const spawnImpl = (executable, args, options) => {
      calls.push({ type: "spawn", executable, args, options });
      mock = mockWorkbench({ root, port });
      void mock.then(({ server }) => {
        // Keep the mock's server alive until this test's finally block.
        calls.push({ type: "mock-listening", server });
      });
      return child;
    };
    const result = await startWorkbench({
      root,
      runtimeDir,
      baseUrl,
      tsxPath,
      noOpen: true,
      spawnImpl,
      startupTimeoutMs: 3_000,
      pollIntervalMs: 10,
    });
    assert.equal(result.state, "running");
    assert.equal(result.reused, false);
    const spawnCall = calls.find((call) => call.type === "spawn");
    assert.equal(spawnCall.executable, process.execPath);
    assert.deepEqual(spawnCall.args, [tsxPath, "workbench-local/server.ts"]);
    assert.equal(spawnCall.options.cwd, root);
    assert.equal(spawnCall.options.detached, true);
    assert.equal(spawnCall.options.stdio[0], "ignore");
    assert.equal(typeof spawnCall.options.stdio[1], "number");
    assert.equal(typeof spawnCall.options.stdio[2], "number");
    assert.equal(result.health.appId, APP_ID);
    assert.equal(result.health.root, root);
    assert.equal(result.health.ready, true);
    assert.equal(await readFile(join(runtimeDir, ".launcher.lock")).catch(() => null), null);
    await close((await mock).server);
  });

  it("gets the bootstrap token and sends it to shutdown, without signalling a PID", async () => {
    const root = await temporaryRoot();
    const mock = await mockWorkbench({ root, token: "known-token" });
    try {
      const result = await stopWorkbench({
        root,
        baseUrl: mock.baseUrl,
        shutdownTimeoutMs: 1_000,
        pollIntervalMs: 10,
      });
      assert.equal(result.state, "stopped");
      assert.deepEqual(mock.state.shutdownHeaders, ["known-token"]);
      assert.equal(mock.state.shutdowns, 1);
    } finally {
      await close(mock.server);
    }
  });

  it("does not remove a live owner's startup lock", async () => {
    const root = await temporaryRoot();
    const runtimeDir = join(root, "runtime");
    const lockPath = join(runtimeDir, ".launcher.lock");
    await mkdir(runtimeDir, { recursive: true });
    const lock = JSON.stringify({ pid: process.pid, token: "live-owner-token", startedAt: new Date().toISOString() });
    await writeFile(lockPath, lock);
    const baseUrl = await freeBaseUrl();
    await assert.rejects(
      startWorkbench({
        root,
        runtimeDir,
        lockPath,
        baseUrl,
        noOpen: true,
        startupTimeoutMs: 50,
        pollIntervalMs: 10,
      }),
      (error) => error instanceof LauncherError && error.code === "STARTUP_LOCK_TIMEOUT",
    );
    // A live owner remains authoritative even while the port is free.
    assert.equal(await readFile(lockPath, "utf8"), lock);
  });
});
