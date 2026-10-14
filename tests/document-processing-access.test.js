/** @jest-environment node */
import { authorizeDocumentProcessing } from '../packages/functions/src/process-document/authorize';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const makeClient=(user, document, profile) => {
  const from=jest.fn((table) => ({select:()=>({eq:()=>({single:async()=>({data:table==='documents'?document:profile,error:null})})})}));
  return {auth:{getUser:jest.fn(async()=>({data:{user:user?{id:user}:null},error:null}))},from};
};
const doc={uploaded_by:'owner',organisation_id:'org-a'};
it('rejects anonymous tokens and ignores caller claims of internal access', async()=>{
  const client=makeClient(null,doc,null);
  expect(await authorizeDocumentProcessing(client,'doc',null,'secret')).toBe(401);
  expect(await authorizeDocumentProcessing(client,'doc','Bearer anon-project-key','secret')).toBe(401);
  expect(client.from).not.toHaveBeenCalled();
});
it('allows the owner and verified staff in the document organisation', async()=>{
  expect(await authorizeDocumentProcessing(makeClient('owner',doc,null),'doc','Bearer user-token','secret')).toBeNull();
  expect(await authorizeDocumentProcessing(makeClient('teacher',doc,{role:'teacher',organisation_id:'org-a'}),'doc','Bearer user-token','secret')).toBeNull();
});
it('denies another tenant and same-organisation students', async()=>{
  expect(await authorizeDocumentProcessing(makeClient('teacher',doc,{role:'teacher',organisation_id:'org-b'}),'doc','Bearer user-token','secret')).toBe(403);
  expect(await authorizeDocumentProcessing(makeClient('student',doc,{role:'student',organisation_id:'org-a'}),'doc','Bearer user-token','secret')).toBe(403);
});
it('retains trusted machine access with the real service credential', async()=>{
  const client=makeClient(null,null,null);
  expect(await authorizeDocumentProcessing(client,'doc','Bearer secret','secret')).toBeNull();
  expect(client.auth.getUser).not.toHaveBeenCalled();
});

describe.each(['process-document','kb-process-textfile','summarize-chunks'])('%s real handler boundary', functionName => {
  it.each([[null, false], ['Bearer other-tenant-token', false], [null, true], ['Bearer other-tenant-token', true]])('denies %s with background=%s before writes or AI calls', async (authorization, background) => {
    const write=jest.fn(), externalFetch=jest.fn();
    const client=makeClient(authorization?'intruder':null,doc,{role:'teacher',organisation_id:'org-b'});
    const readFrom=client.from;
    client.from=jest.fn(table=>({...readFrom(table),update:write,insert:write,upsert:write}));
    let handler;
    const source=fs.readFileSync(path.join(process.cwd(),'packages/functions/src',functionName,'index.ts'),'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(compiled,{
      exports:{},console:{log:jest.fn(),warn:jest.fn(),error:jest.fn()},Response,Request,fetch:externalFetch,
      Deno:{env:{get:key=>key==='SUPABASE_URL'?'http://localhost':'server-secret'}},
      require:id=>id.includes('authorize')?{authorizeDocumentProcessing}
        :id.includes('http/server')?{serve:fn=>{handler=fn;}}
        :id.includes('supabase-js')?{createClient:()=>client}:{},
    });
    const response=await handler(new Request('http://localhost/functions/v1/'+functionName,{
      method:'POST',headers:authorization?{Authorization:authorization}:{},
      body:JSON.stringify({documentId:'victim-document',summarizeLevel:'document',internal:true,background}),
    }));
    expect(response.status).toBe(authorization?403:401);
    expect(write).not.toHaveBeenCalled(); expect(externalFetch).not.toHaveBeenCalled();
  });
});
