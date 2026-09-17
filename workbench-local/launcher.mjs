#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { closeSync, existsSync, openSync } from "node:fs";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const APP_ID = "codex-local-video-workbench";
export const HOST = "127.0.0.1";
export const PORT = 4340;
export const STARTUP_TIMEOUT_MS = 40_000;
export const HEALTH_TIMEOUT_MS = 1_500;
export const POLL_INTERVAL_MS = 200;
export const SHUTDOWN_TIMEOUT_MS = 15_000;

const MODULE_PATH = fileURLToPath(import.meta.url);

export class LauncherError extends Error {
  constructor(message, { code = "LAUNCHER_ERROR", exitCode = 1, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "LauncherError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function repoRootFromModule(moduleUrl = import.meta.url) {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..");
}

export function createConfig(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? options.root ?? repoRootFromModule());
  const port = Number(options.port ?? PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new LauncherError(`无效工作台端口：${String(options.port)}`, {
      code: "INVALID_PORT",
    });
  }
  const runtimeDir = resolve(
    options.runtimeDir ?? resolve(repoRoot, "projects/local-workbench/runtime"),
  );
  return {
    repoRoot,
    port,
    baseUrl: options.baseUrl ?? `http://${HOST}:${port}`,
    runtimeDir,
    logPath: resolve(options.logPath ?? resolve(runtimeDir, "server.log")),
    lockPath: resolve(options.lockPath ?? resolve(runtimeDir, ".launcher.lock")),
    fetchImpl: options.fetchImpl ?? ((...args) => globalThis.fetch(...args)),
    spawnImpl: options.spawnImpl ?? spawn,
    openImpl: options.openImpl ?? spawn,
    tsxPath: options.tsxPath,
    env: options.env ?? process.env,
    startupTimeoutMs: options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS,
    shutdownTimeoutMs: options.shutdownTimeoutMs ?? SHUTDOWN_TIMEOUT_MS,
    healthTimeoutMs: options.healthTimeoutMs ?? HEALTH_TIMEOUT_MS,
    pollIntervalMs: options.pollIntervalMs ?? POLL_INTERVAL_MS,
    noOpen: Boolean(options.noOpen),
    now: options.now ?? (() => Date.now()),
    sleep: options.sleep ?? sleep,
  };
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function isIntegerPid(value) {
  return Number.isInteger(value) && value > 0;
}

function errorCode(error) {
  let current = error;
  while (current) {
    if (typeof current.code === "string") return current.code;
    current = current.cause;
  }
  return undefined;
}

function isConnectionRefused(error) {
  return errorCode(error) === "ECONNREFUSED";
}

function isResponseOk(response) {
  return typeof response?.ok === "boolean"
    ? response.ok
    : Number(response?.status) >= 200 && Number(response?.status) < 300;
}

async function readResponseBody(response) {
  if (typeof response?.text === "function") {
    const text = await response.text();
    if (!text.trim()) return { text, body: null };
    try {
      return { text, body: JSON.parse(text) };
    } catch {
      return { text, body: null };
    }
  }
  if (response && typeof response.body === "object") {
    return { text: JSON.stringify(response.body), body: response.body };
  }
  return { text: "", body: null };
}

async function request(config, path, init = {}, timeoutMs = config.healthTimeoutMs) {
  const controller = new AbortController();
  let timeout;
  const requestPromise = Promise.resolve().then(async () => {
    const response = await config.fetchImpl(config.baseUrl + path, {
      ...init,
      signal: controller.signal,
    });
    const { text, body } = await readResponseBody(response);
    return {
      status: Number(response?.status ?? 0),
      ok: isResponseOk(response),
      body,
      text,
    };
  });
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new LauncherError(`请求 ${path} 超时`, { code: "REQUEST_TIMEOUT" }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

function healthIdentity(body, expectedRoot) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (body.appId !== APP_ID || body.root !== expectedRoot || !isIntegerPid(body.pid)) {
    return null;
  }
  if (typeof body.ready !== "boolean") return null;
  return { appId: body.appId, root: body.root, pid: body.pid, ready: body.ready };
}

export async function inspectService(options = {}) {
  const config = createConfig(options);
  let response;
  try {
    response = await request(config, "/api/health");
  } catch (error) {
    if (isConnectionRefused(error)) {
      return { kind: "free", url: config.baseUrl, config };
    }
    return {
      kind: "unreachable",
      url: config.baseUrl,
      error,
      config,
    };
  }
  const identity = healthIdentity(response.body, config.repoRoot);
  if (!identity) {
    return {
      kind: "foreign",
      url: config.baseUrl,
      status: response.status,
      body: response.body,
      preview: response.text.slice(0, 240),
      config,
    };
  }
  return {
    kind: identity.ready ? "ready" : "starting",
    url: config.baseUrl,
    status: response.status,
    body: response.body,
    identity,
    config,
  };
}

function formatHealthForError(inspection) {
  if (!inspection) return "无状态信息";
  if (inspection.kind === "unreachable") {
    return inspection.error?.message || "网络错误";
  }
  if (inspection.kind === "foreign") {
    return inspection.preview || `HTTP ${inspection.status}`;
  }
  if (inspection.body) return JSON.stringify(inspection.body);
  return inspection.kind;
}

function foreignServiceError(inspection, config) {
  const root = inspection?.body?.root;
  const detail = root && root !== config.repoRoot
    ? `端口 ${config.port} 上的服务根目录是 ${root}`
    : `端口 ${config.port} 没有返回本工作台的健康身份`;
  return new LauncherError(
    `${detail}；为保护其他进程，未启动或停止任何服务。`,
    { code: "FOREIGN_SERVICE", exitCode: 2 },
  );
}

function unreachableError(inspection, config) {
  return new LauncherError(
    `无法安全检查 ${config.baseUrl}（${formatHealthForError(inspection)}）；未启动或停止任何服务。`,
    { code: "HEALTH_UNREACHABLE", exitCode: 2, cause: inspection?.error },
  );
}

async function readLock(config) {
  let raw;
  try {
    raw = await readFile(config.lockPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new LauncherError(`无法读取启动锁 ${config.lockPath}：${error.message}`, {
      code: "LOCK_READ_FAILED",
      cause: error,
    });
  }
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return { malformed: true, raw };
  }
  if (
    !record ||
    typeof record !== "object" ||
    !isIntegerPid(record.pid) ||
    typeof record.token !== "string" ||
    record.token.length < 8
  ) {
    return { malformed: true, raw };
  }
  return record;
}

export function isProcessAlive(pid) {
  if (!isIntegerPid(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user. Treat it as
    // alive so a lock owned by another process can never be removed here.
    return error?.code === "EPERM";
  }
}

async function removeDeadLock(config, candidate) {
  if (!candidate || candidate.malformed || !isIntegerPid(candidate.pid)) return false;
  if (isProcessAlive(candidate.pid)) return false;
  const guardPath = `${config.lockPath}.reap.lock`;
  let guard;
  try {
    guard = await open(guardPath, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw new LauncherError(`无法保护启动锁清理 ${guardPath}：${error.message}`, {
      code: "LOCK_REAP_GUARD_FAILED",
      cause: error,
    });
  }
  try {
    // Re-read under an atomic guard. A second launcher cannot remove a newly
    // acquired lock between this check and unlinking the stale one.
    const current = await readLock(config);
    if (
      !current ||
      current.malformed ||
      current.pid !== candidate.pid ||
      current.token !== candidate.token ||
      isProcessAlive(current.pid)
    ) {
      return false;
    }
    await unlink(config.lockPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw new LauncherError(`无法清理已结束进程的启动锁 ${config.lockPath}：${error.message}`, {
      code: "LOCK_REMOVE_FAILED",
      cause: error,
    });
  } finally {
    await guard.close();
    try {
      await unlink(guardPath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.error(`[launcher] 启动锁清理保护文件未能移除：${error.message}`);
      }
    }
  }
}

async function acquireLock(config) {
  await mkdir(config.runtimeDir, { recursive: true });
  const record = {
    pid: process.pid,
    token: randomUUID(),
    startedAt: new Date(config.now()).toISOString(),
    command: "workbench-local/server.ts",
  };
  let handle;
  try {
    handle = await open(config.lockPath, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") return null;
    throw new LauncherError(`无法创建启动锁 ${config.lockPath}：${error.message}`, {
      code: "LOCK_CREATE_FAILED",
      cause: error,
    });
  }
  try {
    await handle.writeFile(JSON.stringify(record) + "\n", "utf8");
  } catch (error) {
    // The file was created by this invocation. Leave it in place if writing
    // failed: a later invocation will refuse to guess whether an owner exists.
    throw new LauncherError(`无法写入启动锁 ${config.lockPath}：${error.message}`, {
      code: "LOCK_WRITE_FAILED",
      cause: error,
    });
  } finally {
    await handle.close();
  }
  return record;
}

async function releaseLock(config, record) {
  if (!record) return;
  const current = await readLock(config);
  if (
    !current ||
    current.malformed ||
    current.pid !== record.pid ||
    current.token !== record.token
  ) {
    return;
  }
  try {
    await unlink(config.lockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(`[launcher] 启动锁未能清理：${error.message}`);
    }
  }
}

async function waitForReady(config, { childState, returnOnFree = false, timeoutMs, deadline: suppliedDeadline } = {}) {
  const deadline = suppliedDeadline ?? config.now() + (timeoutMs ?? config.startupTimeoutMs);
  let last;
  while (config.now() < deadline) {
    if (childState?.error) {
      throw new LauncherError(
        `工作台进程启动失败：${childState.error.message}；日志：${config.logPath}`,
        { code: "SERVER_SPAWN_FAILED", cause: childState.error },
      );
    }
    last = await inspectService(config);
    if (last.kind === "ready") return last;
    if (last.kind === "foreign") throw foreignServiceError(last, config);
    if (last.kind === "free" && returnOnFree) return last;
    if (last.kind === "unreachable" && childState?.exit) {
      throw new LauncherError(
        `工作台进程已退出（${childState.exit.code ?? childState.exit.signal ?? "未知原因"}）；日志：${config.logPath}`,
        { code: "SERVER_EXITED", cause: childState.exit },
      );
    }
    if (childState?.exit && last.kind !== "ready") {
      throw new LauncherError(
        `工作台进程已退出（${childState.exit.code ?? childState.exit.signal ?? "未知原因"}）；日志：${config.logPath}`,
        { code: "SERVER_EXITED", cause: childState.exit },
      );
    }
    await config.sleep(Math.min(config.pollIntervalMs, Math.max(1, deadline - config.now())));
  }
  throw new LauncherError(
    `工作台在 ${Math.round((timeoutMs ?? config.startupTimeoutMs) / 1000)} 秒内没有就绪；最后状态：${formatHealthForError(last)}；日志：${config.logPath}`,
    { code: "STARTUP_TIMEOUT", exitCode: 1 },
  );
}

async function waitForLockOrReady(config, { deadline: suppliedDeadline } = {}) {
  const deadline = suppliedDeadline ?? config.now() + config.startupTimeoutMs;
  while (config.now() < deadline) {
    const lock = await acquireLock(config);
    if (lock) return { kind: "lock", record: lock };

    const inspection = await inspectService(config);
    if (inspection.kind === "ready") return { kind: "ready", inspection };
    if (inspection.kind === "foreign") throw foreignServiceError(inspection, config);
    if (inspection.kind === "unreachable") throw unreachableError(inspection, config);

    const owner = await readLock(config);
    if (owner && !owner.malformed && !isProcessAlive(owner.pid)) {
      if (await removeDeadLock(config, owner)) continue;
    }
    await config.sleep(Math.min(config.pollIntervalMs, Math.max(1, deadline - config.now())));
  }
  throw new LauncherError(
    `另一项工作台启动仍未完成；启动锁保留在 ${config.lockPath}，未删除其他进程的锁。`,
    { code: "STARTUP_LOCK_TIMEOUT", exitCode: 1 },
  );
}

export function discoverTsx(repoRoot) {
  const candidate = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");
  if (existsSync(candidate)) return candidate;
  throw new LauncherError(
    `找不到本地 tsx CLI：${candidate}。请先在项目目录安装现有依赖后重试；启动器不会下载依赖。`,
    { code: "TSX_NOT_FOUND", exitCode: 1 },
  );
}

function spawnServer(config) {
  const tsxPath = config.tsxPath ?? discoverTsx(config.repoRoot);
  let logFd;
  try {
    logFd = openSync(config.logPath, "a");
  } catch (error) {
    throw new LauncherError(`无法打开工作台日志 ${config.logPath}：${error.message}`, {
      code: "LOG_OPEN_FAILED",
      cause: error,
    });
  }
  let child;
  try {
    child = config.spawnImpl(
      process.execPath,
      [tsxPath, "workbench-local/server.ts"],
      {
        cwd: config.repoRoot,
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: config.env,
      },
    );
  } catch (error) {
    closeSync(logFd);
    throw new LauncherError(`无法启动工作台进程：${error.message}；日志：${config.logPath}`, {
      code: "SERVER_SPAWN_FAILED",
      cause: error,
    });
  }
  closeSync(logFd);
  if (!child || !isIntegerPid(child.pid)) {
    throw new LauncherError(`工作台进程没有返回有效 PID；日志：${config.logPath}`, {
      code: "SERVER_PID_MISSING",
    });
  }
  const state = { pid: child.pid, error: null, exit: null };
  child.once?.("error", (error) => {
    state.error = error;
  });
  child.once?.("exit", (code, signal) => {
    state.exit = { code, signal };
  });
  child.unref?.();
  return { child, state, tsxPath };
}

function openInBrowser(config) {
  if (config.noOpen) return null;
  try {
    const browser = config.openImpl("open", [config.baseUrl + "/"], {
      detached: true,
      stdio: "ignore",
    });
    browser?.once?.("error", (error) => {
      console.error(`[launcher] 浏览器未能自动打开：${error.message}；请手动访问 ${config.baseUrl}/`);
    });
    browser?.unref?.();
    return null;
  } catch (error) {
    return `浏览器未能自动打开：${error.message}；请手动访问 ${config.baseUrl}/`;
  }
}

async function finishStart(config, inspection, { reused, pid } = {}) {
  const openWarning = openInBrowser(config);
  const healthPid = inspection.identity?.pid ?? inspection.body?.pid;
  return {
    command: "start",
    state: "running",
    reused: Boolean(reused),
    // The server's health identity is authoritative. tsx may respawn the
    // TypeScript child, so its launcher PID is only diagnostic evidence.
    pid: healthPid ?? pid,
    launcherPid: pid && pid !== healthPid ? pid : undefined,
    url: config.baseUrl + "/",
    health: inspection.body,
    logPath: config.logPath,
    openWarning,
  };
}

export async function startWorkbench(options = {}) {
  const config = createConfig(options);
  const startupDeadline = config.now() + config.startupTimeoutMs;
  let inspection = await inspectService(config);
  if (inspection.kind === "ready") return finishStart(config, inspection, { reused: true });
  if (inspection.kind === "foreign") throw foreignServiceError(inspection, config);
  if (inspection.kind === "unreachable") throw unreachableError(inspection, config);
  if (inspection.kind === "starting") {
    inspection = await waitForReady(config, { returnOnFree: true, deadline: startupDeadline });
    if (inspection.kind === "ready") return finishStart(config, inspection, { reused: true });
  }

  const acquired = await waitForLockOrReady(config, { deadline: startupDeadline });
  if (acquired.kind === "ready") {
    return finishStart(config, acquired.inspection, { reused: true });
  }
  const lock = acquired.record;
  try {
    inspection = await inspectService(config);
    if (inspection.kind === "ready") {
      return finishStart(config, inspection, { reused: true });
    }
    if (inspection.kind === "foreign") throw foreignServiceError(inspection, config);
    if (inspection.kind === "unreachable") throw unreachableError(inspection, config);
    if (inspection.kind === "starting") {
      inspection = await waitForReady(config, { returnOnFree: true, deadline: startupDeadline });
      if (inspection.kind === "ready") {
        return finishStart(config, inspection, { reused: true });
      }
    }

    const { state } = spawnServer(config);
    inspection = await waitForReady(config, { childState: state, deadline: startupDeadline });
    return finishStart(config, inspection, { reused: false, pid: state.pid });
  } finally {
    await releaseLock(config, lock);
  }
}

export async function statusWorkbench(options = {}) {
  const config = createConfig(options);
  const inspection = await inspectService(config);
  if (inspection.kind === "ready") {
    return {
      command: "status",
      state: "running",
      url: config.baseUrl + "/",
      pid: inspection.identity.pid,
      health: inspection.body,
    };
  }
  if (inspection.kind === "starting") {
    return {
      command: "status",
      state: "starting",
      url: config.baseUrl + "/",
      pid: inspection.identity.pid,
      health: inspection.body,
    };
  }
  if (inspection.kind === "free") {
    return { command: "status", state: "stopped", url: config.baseUrl + "/" };
  }
  if (inspection.kind === "foreign") throw foreignServiceError(inspection, config);
  throw unreachableError(inspection, config);
}

async function getBootstrap(config) {
  let response;
  try {
    response = await request(config, "/api/bootstrap");
  } catch (error) {
    throw new LauncherError(`读取工作台令牌失败：${error.message}`, {
      code: "BOOTSTRAP_FAILED",
      cause: error,
    });
  }
  if (!response.ok || !response.body || typeof response.body.token !== "string" || !response.body.token) {
    throw new LauncherError(
      `工作台没有返回有效停止令牌（HTTP ${response.status || "未知"}）。`,
      { code: "BOOTSTRAP_INVALID", exitCode: 2 },
    );
  }
  return response.body;
}

async function waitForStopped(config, pid) {
  const deadline = config.now() + config.shutdownTimeoutMs;
  let last;
  while (config.now() < deadline) {
    last = await inspectService(config);
    if (last.kind === "free") return true;
    if (last.kind === "foreign") {
      // The original service is gone and another process took the port. Do
      // not inspect or stop that process.
      return true;
    }
    if (last.kind === "ready" || last.kind === "starting") {
      if (last.identity?.pid !== pid) return true;
    }
    await config.sleep(Math.min(config.pollIntervalMs, Math.max(1, deadline - config.now())));
  }
  return false;
}

export async function stopWorkbench(options = {}) {
  const config = createConfig(options);
  let inspection = await inspectService(config);
  if (inspection.kind === "free") {
    return { command: "stop", state: "stopped", alreadyStopped: true };
  }
  if (inspection.kind === "foreign") throw foreignServiceError(inspection, config);
  if (inspection.kind === "unreachable") throw unreachableError(inspection, config);
  const expectedPid = inspection.identity.pid;
  if (inspection.kind === "starting") {
    inspection = await waitForReady(config, {
      timeoutMs: config.startupTimeoutMs,
      returnOnFree: true,
    });
    if (inspection.kind === "free") {
      return { command: "stop", state: "stopped", alreadyStopped: true };
    }
    if (inspection.kind !== "ready") throw new LauncherError("工作台未能就绪，未发送停止请求。", { code: "STOP_NOT_READY" });
    if (inspection.identity.pid !== expectedPid) {
      throw new LauncherError("工作台进程身份在停止前发生变化，未发送停止请求。", {
        code: "IDENTITY_CHANGED",
        exitCode: 2,
      });
    }
  }

  const bootstrap = await getBootstrap(config);
  const beforeShutdown = await inspectService(config);
  if (
    beforeShutdown.kind !== "ready" ||
    beforeShutdown.identity.pid !== expectedPid
  ) {
    if (beforeShutdown.kind === "foreign") throw foreignServiceError(beforeShutdown, config);
    throw new LauncherError("工作台进程身份在停止前发生变化，未发送停止请求。", {
      code: "IDENTITY_CHANGED",
      exitCode: 2,
    });
  }
  let response;
  try {
    response = await request(
      config,
      "/api/shutdown",
      {
        method: "POST",
        headers: { "X-Workbench-Token": bootstrap.token },
      },
      config.shutdownTimeoutMs,
    );
  } catch (error) {
    throw new LauncherError(`发送停止请求失败：${error.message}`, {
      code: "SHUTDOWN_REQUEST_FAILED",
      cause: error,
    });
  }
  if (!response.ok) {
    const reason = response.body?.error || response.text || `HTTP ${response.status}`;
    throw new LauncherError(`工作台拒绝停止：${reason}`, {
      code: "SHUTDOWN_REJECTED",
      exitCode: 2,
    });
  }
  const stopped = await waitForStopped(config, expectedPid);
  return {
    command: "stop",
    state: stopped ? "stopped" : "stopping",
    pid: expectedPid,
    shutdown: response.body,
    verified: stopped,
  };
}

export function parseArgs(argv) {
  let command = "start";
  let commandSeen = false;
  let noOpen = false;
  for (const arg of argv) {
    if (arg === "--no-open") {
      noOpen = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new LauncherError(`未知选项：${arg}\n可用命令：start、status、stop；启动可加 --no-open。`, {
        code: "INVALID_ARGUMENT",
        exitCode: 2,
      });
    }
    if (!commandSeen && ["start", "status", "stop"].includes(arg)) {
      command = arg;
      commandSeen = true;
      continue;
    }
    throw new LauncherError(`未知命令或多余参数：${arg}\n可用命令：start、status、stop；启动可加 --no-open。`, {
      code: "INVALID_ARGUMENT",
      exitCode: 2,
    });
  }
  return { command, noOpen };
}

export function formatResult(result) {
  if (result.command === "status") {
    const labels = { running: "运行中", starting: "启动中", stopped: "未运行" };
    const lines = [`工作台${labels[result.state] ?? result.state}`];
    if (result.url) lines.push(`地址：${result.url}`);
    if (result.pid) lines.push(`PID：${result.pid}`);
    if (result.health) lines.push(JSON.stringify(result.health, null, 2));
    return lines.join("\n");
  }
  if (result.command === "start") {
    const prefix = result.reused ? "已复用运行中的工作台" : "工作台已启动";
    const lines = [prefix, `地址：${result.url}`, `PID：${result.pid}`, `日志：${result.logPath}`];
    if (result.openWarning) lines.push(result.openWarning);
    return lines.join("\n");
  }
  if (result.command === "stop") {
    if (result.alreadyStopped) return "工作台未运行，无需停止。";
    if (result.state === "stopping") {
      return `已发送停止请求（PID ${result.pid}），服务仍在退出；请稍后运行 status。`;
    }
    return `工作台已停止（PID ${result.pid}）。`;
  }
  return JSON.stringify(result, null, 2);
}

export async function runCommand(command, options = {}) {
  if (command === "start") return startWorkbench(options);
  if (command === "status") return statusWorkbench(options);
  if (command === "stop") return stopWorkbench(options);
  throw new LauncherError(`未知命令：${command}`, { code: "INVALID_ARGUMENT", exitCode: 2 });
}

async function main() {
  const { command, noOpen } = parseArgs(process.argv.slice(2));
  const result = await runCommand(command, { noOpen });
  console.log(formatResult(result));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === MODULE_PATH) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[launcher] ${message}`);
    process.exitCode = error?.exitCode ?? 1;
  });
}
