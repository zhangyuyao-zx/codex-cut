import {readFileSync} from 'node:fs';

// One maintained source for the adopted lessons, art direction and user decisions.
export const standards=JSON.parse(readFileSync(new URL('./standards.json',import.meta.url),'utf8'));
export function reviewTopics({film=false,real=false}={}){
 return standards.topics.filter(t=>(!film||t.film)&&(!t.realOnly||real)).map(t=>({...t,reference:!film&&Boolean(t.reference)}));
}
export function topicCoverage(review,topics){
 const known=new Set(standards.topics.map(t=>t.id)),errors=[];
 const findings=review.findings??[],comparisons=review.referenceComparisons??[];
 for(const row of [...findings,...comparisons]){
  if(!Array.isArray(row.topics)||!row.topics.length||row.topics.some(id=>!known.has(id)))errors.push('观察缺少有效的具体比较维度');
 }
 const covered=new Set(findings.flatMap(f=>f.topics??[]));
 const compared=new Set(comparisons.flatMap(f=>f.topics??[]));
 for(const t of topics){
  if(!covered.has(t.id))errors.push('尚未实际检查：'+t.title);
  if(t.reference&&!compared.has(t.id))errors.push('尚未与参考比较：'+t.title);
 }
 return [...new Set(errors)];
}
