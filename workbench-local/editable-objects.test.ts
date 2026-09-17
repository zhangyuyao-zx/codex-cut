import {describe,it,expect} from 'vitest';
import {preserveSceneEdits,validateLegacyOverrides} from './editable-objects';
import {createProductionStore} from './production-store';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const scene:any={id:'a',title:'标题',intent:'说明',startWordId:'w0',endWordId:'w1',beats:[],program:{moduleId:'module',parameters:{caption:'原稿'}},editor:{overrides:{caption:'用户文字',personScale:1.2},locks:['caption']}};
describe('user-owned object parameters',()=>{
 it('keeps edits and locks when Codex changes base parameters',()=>{const [next]=preserveSceneEdits([scene],[{...scene,editor:{overrides:{},locks:[]},program:{...scene.program,parameters:{caption:'模型新稿'}}}]);expect(next.editor).toEqual(scene.editor);});
 it('rejects deleting edited scenes or changing parameter contract implicitly',()=>{expect(()=>preserveSceneEdits([scene],[])).toThrow('用户调整');expect(()=>preserveSceneEdits([scene],[{...scene,program:{moduleId:'other'}}])).toThrow('迁移');});
 it('validates numeric and color values before applying',()=>{expect(()=>validateLegacyOverrides({personScale:Infinity})).toThrow();expect(()=>validateLegacyOverrides({personScale:4})).toThrow();expect(()=>validateLegacyOverrides({accent:'red'})).toThrow();expect(()=>validateLegacyOverrides({personX:50,personScale:1.2,headline:'新的标题'})).not.toThrow();});
 it('persists user edits through Codex writes, reopen, stale rejection and undo',async()=>{const dir=await mkdtemp(join(tmpdir(),'object-edits-'));try{let s=await createProductionStore(dir);await s.setScenes(0,null,[scene],'user');await s.setScenes(1,null,[{...scene,editor:undefined,intent:'新动作'}]);s=await createProductionStore(dir);expect((await s.get()).scenes[0].editor).toEqual(scene.editor);await expect(s.setScenes(1,null,[scene],'user')).rejects.toThrow();expect((await s.undo(2)).scenes[0].editor).toEqual(scene.editor);}finally{await rm(dir,{recursive:true,force:true});}});
});
