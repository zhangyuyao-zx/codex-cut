import {createHash} from 'node:crypto';
import {assets,pack} from './assets.mjs';

const base=process.env.WORKBENCH_URL||'http://127.0.0.1:4340';
const url=new URL(base);
if(url.hostname!=='127.0.0.1'||url.protocol!=='http:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('WORKBENCH_URL must be an http://127.0.0.1:<port> local workbench');
const healthResponse=await fetch(base+'/api/health');
const health=await healthResponse.json();
if(!healthResponse.ok||health.appId!=='codex-local-video-workbench'||!health.ready)throw Error('Not a ready Codex Cut workbench');
const {token}=await(await fetch(base+'/api/bootstrap')).json();
async function read(){const r=await fetch(base+'/api/visual-library');if(!r.ok)throw Error('This workbench needs visual-library support');return r.json();}
async function save(endpoint,body){const current=await read();const r=await fetch(base+'/api/visual-library/'+endpoint,{method:'POST',headers:{'content-type':'application/json','x-workbench-token':token},body:JSON.stringify({expectedRevision:current.revision,...body})});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
for(const asset of assets){
  const existing=(await read()).assets.find(a=>a.id===asset.id&&a.version===asset.version);
  if(existing){if(existing.sourceHash!==createHash('sha256').update(asset.code).digest('hex'))throw Error('Existing version differs: '+asset.id);console.log('Kept '+asset.id);continue;}
  await save('asset',{asset});console.log('Imported candidate '+asset.id);
}
if(!(await read()).packs.some(p=>p.id===pack.id&&p.version===pack.version))await save('pack',{pack});
console.log('Candidates imported. Cut, production, style selection and user approvals were not changed.');
