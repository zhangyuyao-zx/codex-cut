import path from 'node:path';
import {createProjectCheckpoint,verifyProjectCheckpoint,restoreProjectCheckpoint} from './project-checkpoint';
const [command,...args]=process.argv.slice(2);
try{
 if(command==='create'&&args.length===3){
  const [repo,project,destination]=args.map(p=>path.resolve(p));
  const result=await createProjectCheckpoint({repo,project,destination});
  console.log(JSON.stringify({checkpoint:destination,files:result.files.length,createdAt:result.createdAt}));
 }else if(command==='verify'&&args.length===1){
  const result=await verifyProjectCheckpoint(path.resolve(args[0]));
  console.log(JSON.stringify({verified:true,files:result.files.length,createdAt:result.createdAt}));
 }else if(command==='restore'&&args.length===2){
  const result=await restoreProjectCheckpoint(path.resolve(args[0]),path.resolve(args[1]));
  console.log(JSON.stringify({restored:path.resolve(args[1]),files:result.files.length}));
 }else throw Error('用法：checkpoint-cli.ts create <代码目录> <工程目录> <新快照目录> | verify <快照目录> | restore <快照目录> <新恢复目录>');
}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
