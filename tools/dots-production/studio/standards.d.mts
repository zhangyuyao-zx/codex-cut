export interface ReviewTopic {id:string;title:string;question:string;reference?:boolean;film?:boolean;realOnly?:boolean}
export const standards:{id:string;version:number;scope:string;topics:ReviewTopic[];directorLessons:unknown[];artDirection:unknown[];userDecisions:unknown[]};
export function reviewTopics(options?:{film?:boolean;real?:boolean}):ReviewTopic[];
export function topicCoverage(review:{findings?:Array<{topics?:string[]}>;referenceComparisons?:Array<{topics?:string[]}>},topics:ReviewTopic[]):string[];
