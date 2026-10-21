import {expect,it} from 'vitest';
import {compositionComparisons} from './film-direction';
const scene=(id:string,layout:string,moduleId='same')=>({id,program:{moduleId},design:{relationship:'一个观点',objects:[{role:'main',layout,content:id}],actions:[{action:'展开',wordId:id}],message:id}} as any);
it('compares authored composition, independently of component IDs or replacement wording',()=>{
  expect(compositionComparisons([scene('a','全屏标题','one'),scene('b','全屏标题','two')])).toHaveLength(1);
  expect(compositionComparisons([scene('a','全屏标题'),scene('b','人物居中，标题在下方')])).toEqual([]);
});
it('does not invent visual findings for undesigned scenes or label hints as failed scenes',()=>{
  expect(compositionComparisons([{id:'a',program:{moduleId:'same'}},{id:'b',program:{moduleId:'same'}}] as any)).toEqual([]);
  expect(compositionComparisons([scene('a','全屏标题'),scene('b','全屏 标题。')])[0]).toMatchObject({sceneId:'b',withSceneId:'a'});
});
