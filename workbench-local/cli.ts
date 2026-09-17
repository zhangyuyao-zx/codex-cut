import { openAsBlob, createWriteStream } from "node:fs";
import { link, unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {randomUUID} from "node:crypto";
import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";
const url = process.env.WORKBENCH_URL || "http://127.0.0.1:4340";
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(url))throw Error("工作台地址必须是本机127.0.0.1端口");
const bootstrap = await fetch(url + "/api/bootstrap").then((r) => r.json());
const command = process.argv[2] || "get";
if (command === "get") {
  console.log(JSON.stringify(bootstrap.project, null, 2));
} else if(command==="production/animation-templates/export" || command==="production/animation-templates/import") {
  const args=JSON.parse(process.argv[3] || "{}");
  if(typeof args.path!=="string" || !args.path)throw Error("请提供动画包文件路径path");
  if(command.endsWith("/import")) {
    const file=await openAsBlob(args.path);
    if(file.size>1024**3)throw Error("动画包上限1GB");
    const response=await fetch(url+"/api/production/animation-templates/import",{
      method:"POST",headers:{"Content-Type":"application/octet-stream","X-Workbench-Token":bootstrap.token},body:file,
    });
    const result=await response.json();if(!response.ok)throw Error(result.error);
    console.log(JSON.stringify(result,null,2));
  } else {
    if(typeof args.id!=="string" || !args.id)throw Error("请提供动画id");
    const response=await fetch(url+"/api/production/animation-templates/export/"+encodeURIComponent(args.id));
    if(!response.ok)throw Error((await response.json()).error);
    if(!response.headers.get("Content-Type")?.startsWith("application/octet-stream"))throw Error("当前服务尚不支持动画包导出，请更新后重启工作台");
    if(!response.body)throw Error("动画包下载为空");
    const output=resolve(args.path),temporary=output+"."+randomUUID()+".tmp";
    try {
      await pipeline(Readable.fromWeb(response.body as any),createWriteStream(temporary,{flags:"wx",mode:0o600}));
      await link(temporary,output);
      console.log(JSON.stringify({path:output},null,2));
    } finally {await unlink(temporary).catch(()=>undefined);}
  }
} else if (command === "library/assets" || command === "library/import") {
  const args = JSON.parse(process.argv[3] || "{}");
  const importing = command === "library/import";
  const file = importing ? await openAsBlob(args.path) : undefined;
  if (file && file.size > 1024 ** 3) throw Error("素材上限1GB");
  const response = await fetch(
    url +
      "/api/production/component-assets" +
      (importing ? "?name=" + encodeURIComponent(basename(args.path)) : ""),
    {
      method: importing ? "POST" : "GET",
      headers: importing
        ? {
            "Content-Type": "application/octet-stream",
            "X-Workbench-Token": bootstrap.token,
          }
        : undefined,
      body: file,
    },
  );
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  console.log(JSON.stringify(result, null, 2));
} else if (command === "library" || command === "library/detail") {
  const args = JSON.parse(process.argv[3] || "{}");
  const response = await fetch(
    url +
      "/api/library" +
      (command === "library/detail"
        ? "/detail/" + encodeURIComponent(args.id)
        : ""),
  );
  const data = await response.json();
  if (!response.ok) throw Error(data.error);
  if (command === "library" && args.query)
    data.items = data.items.filter((e: any) =>
      (e.id + " " + e.name + " " + e.description)
        .toLowerCase()
        .includes(String(args.query).toLowerCase()),
    );
  console.log(JSON.stringify(data, null, 2));
} else if (command.startsWith("production")) {
  const current = await fetch(url + "/api/production").then((r) => r.json());
  if (command === "production/animation-templates") {
    const r = await fetch(url + "/api/production/animation-templates");
    const result = await r.json();
    if (!r.ok) throw Error(result.error);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "production" || command === "production/context")
    console.log(JSON.stringify(current, null, 2));
  else {
    const args = JSON.parse(process.argv[3] || "{}");
    const allow = [
      "production/scenes",
      "production/parameters",
      "production/rebase",
      "production/request",
      "production/feedback",
      "production/resolve-feedback",
      "production/undo",
      "production/render",
      "production/approve-sample",
      "production/assemble",
      "production/cancel-render",
      "production/animation-templates/save",
      "production/animation-templates/preview",
      "production/animation-templates/apply",
    ];
    if (!allow.includes(command)) throw Error("Unknown production command");
    const r = await fetch(url + "/api/" + command, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workbench-Token": bootstrap.token,
      },
      body: JSON.stringify({
        expectedRevision: current.plan.revision,
        ...args,
      }),
    });
    const result = await r.json();
    if (!r.ok) throw Error(result.error);
    console.log(JSON.stringify(result, null, 2));
  }
} else if (command.startsWith("cut")) {
  const state = await fetch(url + "/api/cut").then((r) => r.json());
  if (command === "cut") console.log(JSON.stringify(state, null, 2));
  else {
    const args = JSON.parse(process.argv[3] || "{}");
    const allowed = [
      "cut/import",
      "cut/ranges",
      "cut/transcript",
      "cut/transcribe",
      "cut/render",
      "cut/undo",
    ];
    if (!allowed.includes(command)) throw Error("Unknown cut command");
    const response = await fetch(url + "/api/" + command, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workbench-Token": bootstrap.token,
      },
      body: JSON.stringify({ expectedRevision: state.revision, ...args }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    console.log(JSON.stringify(result, null, 2));
  }
} else {
  if (!["patch", "undo", "redo"].includes(command))
    throw Error("Use get, patch, undo, redo");
  const body =
    command === "patch"
      ? {
          expectedRevision: bootstrap.project.revision,
          actor: "codex",
          patch: JSON.parse(process.argv[3] || "{}"),
        }
      : { expectedRevision: bootstrap.project.revision };
  const r = await fetch(url + "/api/" + command, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Workbench-Token": bootstrap.token,
    },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error);
  console.log(JSON.stringify(d, null, 2));
}
export {};
