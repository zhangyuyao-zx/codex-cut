import {z} from 'zod';
import {idSchema} from "../shared/timeline-v2/schema.js";
import {speechAnchorSchema} from './scene-motion.js';
const point=z.object({x:z.number().min(0).max(1000),y:z.number().min(0).max(1000)}).strict();
/** Original host-authored motion vocabulary. No external template source is executed. */
export const sceneChoreographySchema=z.object({
 version:z.literal(1),
 purpose:z.string().min(1).max(1000),
 nodes:z.array(z.object({
  id:idSchema,parentObjectId:idSchema,kind:z.enum(['TEXT','RECT','ELLIPSE','PATH']),
  x:z.number().min(0).max(1000),y:z.number().min(0).max(1000),
  width:z.number().positive().max(1000),height:z.number().positive().max(1000),
  text:z.string().max(160).optional(),path:z.string().max(2000).optional(),
  fontSize:z.number().finite().min(0).max(2000).optional(),
  fontWeight:z.number().int().min(100).max(900).refine(value=>value%100===0).optional(),
  letterSpacing:z.number().finite().min(-200).max(200).optional(),
  textAlign:z.enum(['left','center','right']).optional(),
  cornerRadius:z.number().finite().min(0).max(1000).optional(),
  color:z.string().regex(/^#[0-9a-fA-F]{6}$/),
  enter:speechAnchorSchema,
 }).strict()).min(1).max(12),
 actions:z.array(z.object({
  id:idSchema,targetNodeId:idSchema,purpose:z.string().min(1).max(500),
  kind:z.enum(['MOVE','CURVE','DEMOTE','FADE','DRAW']),
  start:speechAnchorSchema,end:speechAnchorSchema,
  to:point.optional(),control:point.optional(),
 }).strict()).max(24),
}).strict().superRefine((plan,ctx)=>{
 const ids=plan.nodes.map(n=>n.id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Node IDs must be unique'});
 if(new Set(plan.actions.map(a=>a.id)).size!==plan.actions.length)ctx.addIssue({code:'custom',message:'Action IDs must be unique'});
 for(const n of plan.nodes){
  if(n.x+n.width>1000||n.y+n.height>1000)ctx.addIssue({code:'custom',message:'Node exceeds canvas'});
  if(n.kind==='TEXT'&&!n.text)ctx.addIssue({code:'custom',message:'TEXT requires text'});
  if(n.kind==='PATH'&&!n.path)ctx.addIssue({code:'custom',message:'PATH requires path'});
 }
 for(const a of plan.actions){
  if(!ids.includes(a.targetNodeId))ctx.addIssue({code:'custom',message:'Unknown action target'});
  if(['MOVE','CURVE','DEMOTE'].includes(a.kind)&&!a.to)ctx.addIssue({code:'custom',message:'Movement requires destination'});
  if(['FADE','DRAW'].includes(a.kind)&&a.to)ctx.addIssue({code:'custom',message:'FADE and DRAW cannot move nodes'});
  if(a.kind!=='CURVE'&&a.control)ctx.addIssue({code:'custom',message:'Only CURVE accepts a control point'});
  if(a.kind==='CURVE'&&!a.control)ctx.addIssue({code:'custom',message:'CURVE requires control point'});
  if(a.kind==='DRAW'&&plan.nodes.find(n=>n.id===a.targetNodeId)?.kind!=='PATH')ctx.addIssue({code:'custom',message:'DRAW requires PATH'});
 }
});
export type SceneChoreography=z.infer<typeof sceneChoreographySchema>;
export function compileChoreography(input:SceneChoreography){
 const plan=sceneChoreographySchema.parse(input);
 const parameters:Record<string,string|number>={};
 const anchors:Record<string,z.infer<typeof speechAnchorSchema>>={};
 const lines:string[]=[];
 const nodes=plan.nodes.map((node,i)=>{
  const p=`item${i+1}`;
  if(node.kind==='TEXT')parameters[`${p}Text`]=node.text!;parameters[`${p}Color`]=node.color;
  parameters[`${p}X`]=node.x;parameters[`${p}Y`]=node.y;
  parameters[`${p}Width`]=node.width;parameters[`${p}Height`]=node.height;
  if(node.fontSize!==undefined)parameters[`${p}FontSize`]=node.fontSize;
  if(node.fontWeight!==undefined)parameters[`${p}FontWeight`]=node.fontWeight;
  if(node.letterSpacing!==undefined)parameters[`${p}LetterSpacing`]=node.letterSpacing;
  if(node.textAlign!==undefined)parameters[`${p}TextAlign`]=node.textAlign;
  if(node.cornerRadius!==undefined)parameters[`${p}CornerRadius`]=node.cornerRadius;
  anchors[`${p}EnterAnchor`]=node.enter;
  let x=`ctx.params.${p}X`,y=`ctx.params.${p}Y`,opacity=`(ctx.frame>=ctx.params.${p}EnterAnchor?1:0)`,scale='1',draw='1';
  for(const [j,a] of plan.actions.entries()){
   if(a.targetNodeId!==node.id)continue;
   const key=`action${j+1}`;
   anchors[`${key}StartAnchor`]=a.start;anchors[`${key}EndAnchor`]=a.end;
   lines.push(`const ${key}Progress=clamp((ctx.frame-ctx.params.${key}StartAnchor)/(ctx.params.${key}EndAnchor-ctx.params.${key}StartAnchor),0,1);`);
   lines.push(`const ${key}Ease=${key}Progress*${key}Progress*(3-2*${key}Progress);`);
   const t=`${key}Ease`;
   if(a.to){
    parameters[`${key}X`]=a.to.x;parameters[`${key}Y`]=a.to.y;
    const tx=`ctx.params.${key}X`,ty=`ctx.params.${key}Y`;
    lines.push(`const ${key}X=${a.kind==='CURVE'?`(1-${t})*(1-${t})*(${x})+2*(1-${t})*${t}*${a.control!.x}+${t}*${t}*${tx}`:`lerp(${x},${tx},${t})`};`);
    lines.push(`const ${key}Y=${a.kind==='CURVE'?`(1-${t})*(1-${t})*(${y})+2*(1-${t})*${t}*${a.control!.y}+${t}*${t}*${ty}`:`lerp(${y},${ty},${t})`};`);
    x=`${key}X`;y=`${key}Y`;
   }
   if(a.kind==='DEMOTE')scale=`(${scale})*lerp(1,0.65,${t})`;
   if(a.kind==='FADE')opacity=`(${opacity})*(1-${t})`;
   if(a.kind==='DRAW')draw=t;
  }
  const style=[
   node.fontSize===undefined?'':`,fontSize:ctx.params.${p}FontSize`,
   node.fontWeight===undefined?'':`,fontWeight:ctx.params.${p}FontWeight`,
   node.letterSpacing===undefined?'':`,letterSpacing:ctx.params.${p}LetterSpacing`,
   node.textAlign===undefined?'':`,textAlign:ctx.params.${p}TextAlign`,
   node.cornerRadius===undefined?'':`,cornerRadius:ctx.params.${p}CornerRadius`,
  ].join('');
  return `{id:${JSON.stringify(node.id)},parentObjectId:${JSON.stringify(node.parentObjectId)},kind:${JSON.stringify(node.kind)},x:${x},y:${y},width:ctx.params.${p}Width,height:ctx.params.${p}Height,${node.kind==='TEXT'?`text:ctx.params.${p}Text,`:''}fill:${node.kind==='PATH'?'"none"':`ctx.params.${p}Color`},stroke:ctx.params.${p}Color,strokeWidth:${node.kind==='PATH'?2:0},${node.path?`path:${JSON.stringify(node.path)},`:''}opacity:${opacity},scale:${scale},drawProgress:${draw}${style}}`;
 });
 return {source:`export default function scene(ctx){\n${lines.join('\n')}\nreturn {nodes:[${nodes.join(',\n')}]};\n}`,parameters,anchors};
}
