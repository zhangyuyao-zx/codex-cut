import {accessSync,constants,existsSync,statSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
/** Explicit overrides take priority; otherwise use the machine's PATH, then common macOS locations. */
export function runtimeCommand(name:'ffmpeg'|'ffprobe'|'whisper',env:NodeJS.ProcessEnv=process.env):string{
 const override=env[`WORKBENCH_${name.toUpperCase()}`];
 if(override){try{accessSync(override,constants.X_OK);if(!statSync(override).isFile())throw Error("not a file");}catch{throw Error(`运行文件不可执行：${override}`);}return override;}
 const dirs=[...(env.PATH||'').split(path.delimiter),'/opt/homebrew/bin','/usr/local/bin'];
 for(const dir of dirs.filter(Boolean)){const p=path.join(dir,process.platform==='win32'?name+'.exe':name);try{accessSync(p,constants.X_OK);if(statSync(p).isFile())return p;}catch{}}
 throw Error(`缺少 ${name}，请安装或设置 WORKBENCH_${name.toUpperCase()} 指向可执行文件`);
}
export function whisperModelPath(env:NodeJS.ProcessEnv=process.env){return env.WORKBENCH_WHISPER_MODEL || path.join(homedir(),'.cache','whisper','small.pt');}
export function remotionRuntime(root:string,env:NodeJS.ProcessEnv=process.env){
 const legacyBrowser=path.resolve(root,'runtime/remotion/chrome/chrome-headless-shell-mac-arm64/chrome-headless-shell');
 const legacyCompositor=path.resolve(root,'runtime/remotion/compositor');
 const browserExecutable=env.WORKBENCH_CHROME || (process.platform==='darwin'&&process.arch==='arm64'&&existsSync(legacyBrowser)?legacyBrowser:undefined);
 const binariesDirectory=env.WORKBENCH_COMPOSITOR || (process.platform==='darwin'&&process.arch==='arm64'&&existsSync(legacyCompositor)?legacyCompositor:undefined);
 for(const p of [browserExecutable,binariesDirectory])if(p&&!existsSync(p))throw Error(`渲染运行环境不存在：${p}`);
 if(browserExecutable){accessSync(browserExecutable,constants.X_OK);if(!statSync(browserExecutable).isFile())throw Error("浏览器路径不是文件");}
 if(binariesDirectory&&!statSync(binariesDirectory).isDirectory())throw Error("合成器路径不是目录");
 return {...(browserExecutable?{browserExecutable}:{}),...(binariesDirectory?{binariesDirectory}:{})};
}
