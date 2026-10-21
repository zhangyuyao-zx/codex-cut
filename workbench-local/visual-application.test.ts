import {it,expect} from 'vitest';
import {planStyleApplication,resolveVisualCues} from './visual-application';
import {assertNoNewLegacyComponents} from './component-library';
import {resolveVisualValues,visualAssetInputSchema} from './visual-library-contract';

it('binds multiple semantic events to the same target word without duplicate story beats',()=>{
  const words=[{sourceId:'cut-word',text:'开始',startMs:1000,endMs:1200}],cues=[{id:'title',label:'标题出现',required:true},{id:'focus',label:'焦点进入',required:true}];
  expect(resolveVisualCues(cues,{title:'cut-word',focus:'cut-word'},words,800,1600).map(b=>b.label)).toEqual(['title','focus']);
  expect(()=>resolveVisualCues(cues,{title:'deleted',focus:'cut-word'},words,800,1600)).toThrow('已删除');
  expect(()=>resolveVisualCues(cues,{title:'cut-word',focus:'cut-word'},words,1300,1600)).toThrow('段落内');
});
it('applies pack defaults below explicit content and separately-owned locked user edits',()=>{
  const asset:any={id:'title',version:'1.0.0',moduleId:'va-title-v1-0-0',controls:[{key:'accent',label:'颜色',type:'color',default:'#000000'},{key:'text',label:'内容',type:'text'}],styleBindings:{accent:'accent'}};
  const pack:any={id:'paper',version:'1.0.0',name:'纸面',status:'draft',members:[{id:'title',version:'1.0.0'}],tokens:{accent:'#FF4400'},overrides:{}};
  const scene:any={id:'one',title:'段落',program:{moduleId:asset.moduleId,parameters:{text:'真实内容',accent:'#112233'}},editor:{overrides:{accent:'#AABBCC'},locks:['accent']}};
  const plan:any={scenes:[scene]};const next=planStyleApplication(plan,pack,[asset]);
  expect(next.conflicts).toEqual([]);expect(next.affected).toEqual(['段落']);expect(next.scenes[0].editor).toEqual(scene.editor);
  expect(resolveVisualValues(asset.controls,{...next.scenes[0].program!.styleDefaults,...next.scenes[0].program!.parameters,...next.scenes[0].editor!.overrides})).toEqual({text:'真实内容',accent:'#AABBCC'});
  expect(scene.program.styleDefaults).toBeUndefined();
});
it('blocks adding retired components but keeps existing saved instances editable',()=>{
  const old={id:'scene',components:[{id:'existing',componentId:'component:v1:text-clean-card',props:{text:'旧'}}]};
  expect(()=>assertNoNewLegacyComponents([old],[{...old,components:old.components.map(c=>({...c,props:{text:'可修改'}}))}])).not.toThrow();
  expect(()=>assertNoNewLegacyComponents([], [old])).toThrow('退役');
  expect(()=>assertNoNewLegacyComponents([], [{id:'scene',components:[{id:'new',componentId:'visual:title@1.0.0'}]}])).not.toThrow();
});
it('shares style vocabulary with original nonmember scenes and reports untouched paragraphs',()=>{
  const controls:any=[{key:'ink',label:'文字',type:'color',default:'#000000'},{key:'text',label:'内容',type:'text'}];
  const asset:any={id:'original',version:'1.0.0',moduleId:'original-asset',controls,styleBindings:{ink:'ink'}};
  const module:any={id:'custom-scene',controls,styleBindings:{ink:'ink'}};
  const pack:any={id:'paper',version:'1.0.0',name:'纸面',members:[],tokens:{ink:'#223344'},overrides:{}};
  const scenes:any=[
    {id:'a',title:'原创资产',program:{moduleId:'original-asset',parameters:{text:'内容甲'}}},
    {id:'b',title:'项目原创',program:{moduleId:'custom-scene',parameters:{text:'内容乙'}},editor:{overrides:{ink:'#556677'},locks:['ink']}},
    {id:'c',title:'未适配',program:{moduleId:'other',parameters:{}}},
    {id:'d',title:'待创作'},
  ];
  const next=planStyleApplication({scenes} as any,pack,[asset],[module]);
  expect(next.scenes[0].program!.styleDefaults).toEqual({ink:'#223344'});
  expect(next.scenes[1].program!.styleDefaults).toEqual({ink:'#223344'});
  expect(next.scenes[1].editor).toEqual(scenes[1].editor);
  expect(next.coverage).toMatchObject({total:4,mapped:1,partial:1,unmapped:2,preserved:1});
  expect(next.coverage.scenes.map(s=>s.status)).toEqual(['mapped','partial','unmapped','unimplemented']);
  expect(scenes[0].program.styleDefaults).toBeUndefined();
});
it('does not report complete coverage when required style mappings are absent or invalid',()=>{
  const controls:any=[{key:'accent',label:'强调',type:'color'},{key:'ink',label:'文字',type:'color'}];
  const asset:any={id:'a',version:'1.0.0',moduleId:'a',controls,styleBindings:{accent:'accent',ink:'missing'}};
  const pack:any={members:[],tokens:{accent:'#123456'},overrides:{}};
  const plan:any={scenes:[{id:'one',title:'部分',program:{moduleId:'a',parameters:{}}}]};
  const good=planStyleApplication(plan,pack,[asset]);
  expect(good.coverage.scenes[0]).toMatchObject({status:'partial',missing:['ink']});
  const invalid=planStyleApplication(plan,{...pack,tokens:{accent:'invalid'}},[asset]);
  expect(invalid.conflicts).toHaveLength(1);
  expect(invalid.coverage.scenes[0].status).toBe('conflict');
  expect(invalid.scenes[0]).toEqual(plan.scenes[0]);
});
it('validates structural inputs and bound constraints instead of silently truncating content',()=>{
  expect(()=>resolveVisualValues([{key:'items',label:'步骤',type:'list',itemType:'text',minItems:2,maxItems:4}],{items:['只有一步']})).toThrow('数量');
  expect(()=>resolveVisualValues([{key:'mode',label:'布局',type:'select',options:['left','center']}],{mode:'unknown'})).toThrow('选项');
  expect(visualAssetInputSchema.safeParse({id:'a',version:'1.0.0',name:'a',description:'b',kind:'component',mount:'OBJECT',source:{kind:'authored',note:'test'},controls:[{type:'number',key:'size',label:'大小',min:5,max:2}],code:'export const VisualAsset=()=>null;'}).success).toBe(false);
});
