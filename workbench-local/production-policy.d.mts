export type AuthoringRequirement={required:boolean;configured:boolean;file:string;contentId:string|null;method:string|null;gateVersion:number};
export function authoringRequirement(root:string,projectDir:string):Promise<AuthoringRequirement>;
export function initializeProductionAuthoring(root:string,projectDir:string):Promise<AuthoringRequirement>;
