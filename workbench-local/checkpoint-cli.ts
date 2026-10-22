import path from 'node:path';
import {createProjectCheckpoint,verifyProjectCheckpoint,restoreProjectCheckpoint} from './project-checkpoint';
const [command,...args]=process.argv.slice(2);
try{
 if(command==='create'&&(args.length===3 || (args.length===5 && args[3]==='--label'))){
  const [repo,project,destination]=args.slice(0,3).map(p=>path.resolve(p));
  const result=await createProjectCheckpoint({repo,project,destination,label:args[4]});
  console.log(JSON.stringify({checkpoint:destination,files:result.files.length,createdAt:result.createdAt,label:result.label,source:result.source,contentIdentity:result.contentIdentity}));
 }else if(command==='verify'&&args.length===1){
  const result=await verifyProjectCheckpoint(path.resolve(args[0]));
  console.log(JSON.stringify({verified:true,files:result.files.length,createdAt:result.createdAt,label:result.label,source:result.source,contentIdentity:result.contentIdentity}));
 }else if(command==='restore'&&args.length===2){
  const result=await restoreProjectCheckpoint(path.resolve(args[0]),path.resolve(args[1]));
  console.log(JSON.stringify({restored:path.resolve(args[1]),files:result.files.length,label:result.label,source:result.source,contentIdentity:result.contentIdentity}));
 }else throw Error('用法：checkpoint-cli.ts create <代码目录> <工程目录> <新快照目录> [--label <备份名称>] | verify <快照目录> | restore <快照目录> <新恢复目录>');
}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
