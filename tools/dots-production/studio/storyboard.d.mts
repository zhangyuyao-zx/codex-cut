export function storyboardKey(book:any,plan:any,sceneId:string):string;
export function storyboardStatus(args:{book:any;plan:any;sceneId:string;digest:(file:string)=>Promise<string>;resolveFile:(file:string)=>string}):Promise<{status:string;approved:boolean;reason:string}>;
