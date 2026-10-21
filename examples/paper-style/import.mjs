import {readFile,readdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const dir=dirname(fileURLToPath(import.meta.url)),url=process.env.WORKBENCH_URL||'http://127.0.0.1:4340';
const parsed=new URL(url);if(parsed.hostname!=='127.0.0.1'||parsed.protocol!=='http:'||parsed.pathname!=='/')throw Error('WORKBENCH_URL must be an http://127.0.0.1:<port> local workbench');
const health=await (await fetch(url+'/api/health')).json();if(health.appId!=='codex-local-video-workbench'||!health.ready)throw Error('Not a ready Codex Cut workbench');
const {token}=await (await fetch(url+'/api/bootstrap')).json();
async function state(){const r=await fetch(url+'/api/visual-library');if(!r.ok)throw Error('This workbench needs visual-library support');return r.json();}
async function post(endpoint,body){const current=await state(),r=await fetch(url+'/api/visual-library/'+endpoint,{method:'POST',headers:{'content-type':'application/json','x-workbench-token':token},body:JSON.stringify({expectedRevision:current.revision,...body})});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
for(const file of (await readdir(dir)).filter(f=>f.startsWith('example-')&&f.endsWith('.json')).sort()){
 const {codeFile,...asset}=JSON.parse(await readFile(resolve(dir,file),'utf8'));
 if(typeof codeFile!=='string'||codeFile!==asset.id+'.tsx')throw Error('Invalid example entry');
 const code=await readFile(resolve(dir,codeFile),'utf8'),existing=(await state()).assets.find(a=>a.id===asset.id&&a.version===asset.version);
 if(existing){if(existing.sourceHash!==createHash('sha256').update(code).digest('hex'))throw Error('Existing version differs: '+asset.id);console.log('Kept existing '+asset.id);continue;}
 await post('asset',{asset:{...asset,code}});console.log('Imported candidate '+asset.id);
}
const pack=JSON.parse(await readFile(resolve(dir,'pack.json'),'utf8'));
if(!(await state()).packs.some(p=>p.id===pack.id&&p.version===pack.version))await post('pack',{pack});
console.log('Examples imported as candidates. No cut, production, approval or ready state was changed.');
