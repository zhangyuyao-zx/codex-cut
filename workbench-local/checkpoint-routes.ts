import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {lstat,mkdir,readdir,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createProjectCheckpoint,verifyProjectCheckpoint,restoreProjectCheckpoint} from './project-checkpoint';

const validId=(id:unknown):id is string=>typeof id==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
/** Fixed local destinations. The browser cannot supply a filesystem path. */
export function checkpointRoutes(options:{repo:string;project:string;directory?:string;assertIdle:()=>Promise<void>}) {
  const router=Router();
  const directory=path.resolve(options.directory || path.join(path.dirname(options.repo),path.basename(options.repo)+'-备份'));
  let task:any=null, pending:Promise<void>|null=null, reserved=false;
  async function ensureDirectory(){
    await mkdir(directory,{recursive:true});
    if((await lstat(directory)).isSymbolicLink() || await realpath(directory)!==directory)throw Error('备份目录不能通过软链接访问');
  }
  async function checkpoint(id:unknown){
    if(!validId(id))throw Error('请选择已有备份');
    const file=path.join(directory,id);
    if(!(await lstat(file)).isDirectory() || (await lstat(file)).isSymbolicLink())throw Error('备份目录无效');
    return file;
  }
  async function list(){
    let names:string[];
    try {
      const info=await lstat(directory);
      if(!info.isDirectory() || info.isSymbolicLink() || await realpath(directory)!==directory)throw Error('备份目录不能通过软链接访问');
      names=await readdir(directory);
    }catch(e:any){if(e.code==='ENOENT')return [];throw e;}
    const items=[];
    for(const id of names.filter(validId)){
      try {
        const file=await checkpoint(id),meta=path.join(file,'checkpoint.json');
        if(!(await lstat(meta)).isFile() || (await lstat(meta)).isSymbolicLink())continue;
        const m=JSON.parse(await readFile(meta,'utf8'));
        if(m.schemaVersion!==1 || !Array.isArray(m.files) || typeof m.createdAt!=='string')continue;
        items.push({id,createdAt:m.createdAt,files:m.files.length,bytes:m.files.reduce((n:number,e:any)=>n+(Number.isSafeInteger(e.bytes)?e.bytes:0),0),path:file});
      }catch{} // Incomplete or foreign folders are not advertised as usable backups.
    }
    return items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  router.get('/task',(_req,res)=>res.json({task,busy:reserved}));
  router.get('/',async(_req,res,next)=>{try{res.json({directory,items:await list(),task,busy:reserved});}catch(e){next(e);}});
  router.post('/:operation',async(req,res,next)=>{
    if(reserved){next(Error('正在备份或校验，请等待完成'));return;}
    reserved=true;
    try {
      const operation=req.params.operation;
      if(!['create','verify','restore'].includes(operation))throw Error('备份操作无效');
      await options.assertIdle();
      await ensureDirectory();
      const id=operation==='create'?randomUUID():req.body.id;
      const source=operation==='create'?null:await checkpoint(id);
      const destination=operation==='create'?path.join(directory,id):operation==='restore'?path.join(directory,'恢复副本-'+randomUUID()):undefined;
      task={id:randomUUID(),operation,status:'running',startedAt:new Date().toISOString(),checkpointId:id};
      pending=(async()=>{
        try {
          const result=operation==='create'?await createProjectCheckpoint({repo:options.repo,project:options.project,destination:destination!}):operation==='verify'?await verifyProjectCheckpoint(source!):await restoreProjectCheckpoint(source!,destination!);
          task={...task,status:'done',files:result.files.length,path:destination||source,verified:true};
        }catch(e){task={...task,status:'failed',error:e instanceof Error?e.message:String(e)};}
        finally{reserved=false;}
      })();
      res.json({task,busy:true});
    }catch(e){reserved=false;next(e);}
  });
  return Object.assign(router,{isBusy:()=>reserved,waitForIdle:async()=>{await pending;}});
}
