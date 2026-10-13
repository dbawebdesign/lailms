/** @jest-environment node */
import { generationCacheKey } from '../src/lib/services/generation-cache-key';
const task={id:'task-a',job_id:'job-a',input_data:{lessonTitle:'Cells',sectionTitle:'Introduction'}};
it('isolates identical headings across jobs, tasks, courses and users', () => {
  const request={userId:'alice',baseClassId:'class-a'};
  const key=generationCacheKey(task,request);
  expect(generationCacheKey(task,request)).toBe(key);
  expect(generationCacheKey({...task,job_id:'job-b'},request)).not.toBe(key);
  expect(generationCacheKey({...task,id:'task-b'},request)).not.toBe(key);
  expect(generationCacheKey(task,{...request,userId:'bob'})).not.toBe(key);
  expect(generationCacheKey(task,{...request,baseClassId:'class-b'})).not.toBe(key);
  expect(generationCacheKey(task,{...request,generationMode:'kb_only'})).not.toBe(key);
});
it('disables cache without a complete job/task identity', () => {
  expect(generationCacheKey({id:'task'},{})).toBeNull();
  expect(generationCacheKey({job_id:'job'},{})).toBeNull();
});
