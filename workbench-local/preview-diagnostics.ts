import {useEffect,useState,type RefObject} from 'react';
import type {PlayerRef} from '@remotion/player';

/** Preview-only diagnostics. Inspect after a seek/pause, never in the frame loop. */
export function usePreviewDiagnostics(host:RefObject<HTMLDivElement|null>,player:RefObject<PlayerRef|null>,
  identity:string,objects:readonly {id:string;label?:string;canvas?:{text?:string}}[],enabled:boolean) {
  const [messages,setMessages]=useState<string[]>([]);
  useEffect(()=>{
    setMessages([]);
    const root=host.current;
    if(!root||!enabled)return;
    let active=true,timer:ReturnType<typeof setTimeout>|undefined;
    const failures=new Set<string>();
    const label=(node:Element)=>{
      const id=node.closest('[data-editable-object]')?.getAttribute('data-editable-object');
      return objects.find(object=>object.id===id)?.label||id||'当前段落';
    };
    const check=()=>{
      if(!active)return;
      const result=new Set(failures);
      for(const node of Array.from(root.querySelectorAll('img,video,audio'))){
        if(node instanceof HTMLImageElement&&node.getAttribute('src')&&node.complete&&!node.naturalWidth)result.add(`${label(node)}：图片无法加载`);
        if(node instanceof HTMLMediaElement&&node.error)result.add(`${label(node)}：${node.tagName==='AUDIO'?'音频':'视频'}无法加载`);
      }
      const families=[getComputedStyle(root).fontFamily,...Array.from(root.querySelectorAll('[data-editable-object],h1,h2,p')).map(node=>getComputedStyle(node).fontFamily)].join(',');
      document.fonts?.forEach(font=>{if(font.status==='error'&&families.includes(font.family.replace(/["']/g,'')))result.add(`字体 ${font.family} 加载失败，请检查字体文件`);});
      // Deliberately conservative: only text objects explicitly exposed by the
      // author. This is a warning for review, not an automatic design rejection.
      for(const node of Array.from(root.querySelectorAll<HTMLElement>('[data-editable-object]'))){
        const object=objects.find(object=>object.id===node.dataset.editableObject&&object.canvas?.text);
        if(object&&node.clientWidth&&node.clientHeight&&(node.scrollWidth>node.clientWidth+4||(node.style.height&&node.scrollHeight>node.clientHeight+4)))
          result.add(`${object.label||object.id}：文字可能超出对象范围`);
      }
      setMessages([...result].slice(0,3));
    };
    const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(check,100);};
    const failed=(event:Event)=>{
      if(event.target instanceof HTMLImageElement||event.target instanceof HTMLMediaElement){
        failures.add(`${label(event.target)}：${event.target.tagName==='IMG'?'图片':'音视频'}无法加载`);schedule();
      }
    };
    root.addEventListener('error',failed,true);
    document.fonts?.addEventListener('loadingerror',schedule);
    document.fonts?.addEventListener('loadingdone',schedule);
    void document.fonts?.ready.then(()=>{if(active)schedule();});
    const current=player.current;
    current?.addEventListener('pause',schedule);current?.addEventListener('seeked',schedule);
    schedule();
    return()=>{active=false;if(timer)clearTimeout(timer);root.removeEventListener('error',failed,true);
      document.fonts?.removeEventListener('loadingerror',schedule);document.fonts?.removeEventListener('loadingdone',schedule);
      current?.removeEventListener('pause',schedule);current?.removeEventListener('seeked',schedule);};
  },[identity,enabled]);
  return messages;
}
