import {describe,it,expect} from 'vitest';
import {createComponentLibrary} from './component-library';
import {COMPONENT_LIBRARY} from "../modules/components/component-library";
import {componentSelectionSchema} from './production-store';
describe('final App library migration',()=>{
 it('uses readable new-object defaults without replacing saved text sizes',async()=>{
   const lib=await createComponentLibrary(process.cwd());
   const detail=await lib.detail('component:v1:text-clean-card');
   expect(detail.fields.find(f=>f.name==='fontSize')?.value).toBe(96);
   expect(detail.thumbnailProps.fontSize).toBe(96);
   const saved=await lib.validate({componentId:detail.id,props:{text:'用户保留的字号',fontSize:36}});
   expect(saved.resolvedParameters.fontSize).toBe(36);
 });
 it('provides valid demo parameters for all click-to-preview entries',async()=>{
   const lib=await createComponentLibrary(process.cwd());
   for(const c of COMPONENT_LIBRARY){
     const d=await lib.detail(c.componentId);
     await expect(lib.validate({componentId:d.id,props:d.thumbnailProps}),d.id).resolves.toHaveProperty('resolvedParameters');
   }
 });
 it('opens every component with optional JSON omitted until explicitly customized',async()=>{
   const lib=await createComponentLibrary(process.cwd());
   for(const c of COMPONENT_LIBRARY){
     const d=await lib.detail(c.componentId);
     // Reproduce UI initialization; supply ONLY required content as a user would.
     const values=Object.fromEntries(d.fields.filter(f=>f.value!==undefined).map(f=>[f.name,f.value]));
     for(const field of d.fields) {
       if(field.required) values[field.name]=c.sampleParameters[field.name];
       if(field.type==='json'&&!field.required&&c.defaultParameters[field.name]===undefined)
         expect(values,`${c.componentId}/${field.name}`).not.toHaveProperty(field.name);
       if(field.name==='cueFrames') expect(field.sample).toEqual([0]);
     }
     await expect(lib.validate({componentId:c.componentId,props:values}),c.componentId).resolves.toHaveProperty('appAdapter',true);
   }
 });
 it('uses all 194 final definitions and rejects old research identities',async()=>{const lib=await createComponentLibrary(process.cwd());expect(COMPONENT_LIBRARY.length).toBe(194);for(const c of COMPONENT_LIBRARY){const d=await lib.detail(c.componentId);expect(d.name).toBe(c.label);expect(d.fields.map(f=>f.name)).toEqual(c.controls.map(f=>f.key));}await expect(lib.detail('rs-text-typewriter')).rejects.toThrow('最终盘点');});
 it('uses existing App parameter validation including nested chart data',async()=>{const lib=await createComponentLibrary(process.cwd());await expect(lib.validate({componentId:'component:next-core:v1:bar-chart',props:{data:[{label:'甲',value:3},{label:'乙',value:5}],title:'对比',unit:'次'}})).resolves.toHaveProperty('appAdapter',true);await expect(lib.validate({componentId:'component:v1:text-clean-card',props:{text:'内容',fontSize:999}})).rejects.toThrow();});
 it('accepts bounded JSON parameters while preserving placement validation',()=>{const s={id:'one',componentId:'component:next-core:v1:bar-chart',props:{data:[{label:'甲',value:3}]},startWordId:'word-0',endWordId:'word-1',x:0,y:0,scale:1,opacity:1};expect(componentSelectionSchema.safeParse(s).success).toBe(true);expect(componentSelectionSchema.safeParse({...s,scale:0}).success).toBe(false);});
});
