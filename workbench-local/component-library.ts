import {Router} from 'express';
import {resolve} from 'node:path';
import {createComponentLibrary as createLegacyComponentLibrary} from './legacy-component-library';
import type {VisualLibraryService} from './visual-library-service';
import {resolveVisualValues,visualMemberSchema,memberKey,type VisualMember} from './visual-library-contract';

type Legacy=Awaited<ReturnType<typeof createLegacyComponentLibrary>>;
type Detail=Awaited<ReturnType<Legacy['detail']>> & {visualAdapter?:boolean;asset?:any};
export const visualComponentId=(member:VisualMember)=>'visual:'+memberKey(member);
export function parseVisualComponentId(id:string):VisualMember|undefined{
  if(!id.startsWith('visual:'))return undefined;
  const [assetId,version,...rest]=id.slice(7).split('@');if(rest.length)throw Error('资产编号无效');
  return visualMemberSchema.parse({id:assetId,version});
}
/** Default selection contains only the new library. Historical IDs resolve for saved projects. */
export async function createComponentLibrary(root:string,presetDir=resolve(root,'projects/local-workbench/library-presets'),visual?:VisualLibraryService){
  const legacy=await createLegacyComponentLibrary(root,presetDir),router=Router();
  async function detail(id:string):Promise<Detail>{
    const member=parseVisualComponentId(id);if(!member)return legacy.detail(id);
    if(!visual)throw Error('视觉资产库未接入');
    const asset=await visual.store.getAsset(member),module=await visual.sceneProvider.detail(asset.moduleId);
    if(!module)throw Error('资产实现不存在');
    return {...asset,id,name:asset.name,description:asset.description,category:asset.kind,source:'对标提炼与原创资产',runtime:true,appAdapter:false,visualAdapter:true,mount:asset.mount,preview:asset.previews.findLast(p=>p.status==='done')?.url??null,thumbnail:null,thumbnailProps:asset.sampleValues,mediaSlots:asset.mediaSlots,modulePath:module.modulePath,moduleUrl:module.moduleUrl,exportName:module.exportName,width:1920,height:1080,fields:asset.controls.map(c=>({...c,name:c.key,value:c.default,sample:asset.sampleValues[c.key]})),asset} as unknown as Detail;
  }
  async function validate(selection:any){
    const member=parseVisualComponentId(selection.componentId);if(!member)return {...await legacy.validate(selection),visualAdapter:false,asset:undefined,moduleUrl:undefined};
    const d=await detail(selection.componentId),asset=d.asset;
    return {...d,resolvedParameters:resolveVisualValues(asset.controls,{...selection.styleDefaults,...selection.props}),requiredMedia:asset.mediaSlots.length};
  }
  router.get('/',async(_req,res,next)=>{try{const state=visual?await visual.store.get():{revision:0,assets:[],favorites:[]};const available=state.assets.filter(a=>a.status==='ready');res.json({revision:state.revision,items:await Promise.all(available.map(a=>detail(visualComponentId(a)))),presets:[],favorites:state.favorites,counts:{total:available.length,runtime:available.length,favorites:state.favorites.length},legacySelection:false});}catch(e){next(e);}});
  router.get('/detail/:id',async(req,res,next)=>{try{res.json(await detail(String(req.params.id)));}catch(e){next(e);}});
  return {router,detail,validate,favorites:legacy.favorites};
}

/** New scenes cannot introduce retired IDs; old saved instances remain editable. */
export function assertNoNewLegacyComponents(previous:any[],next:any[]){
  const saved=new Set(previous.flatMap(s=>(s.components??[]).map((c:any)=>`${s.id}:${c.id}:${c.componentId}`)));
  for(const s of next)for(const c of s.components??[])if(!parseVisualComponentId(c.componentId)&&!saved.has(`${s.id}:${c.id}:${c.componentId}`))throw Error('旧组件已退役，请选用新视觉资产；已有工程中的旧对象可继续查看和修改');
}
