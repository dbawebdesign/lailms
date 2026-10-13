/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/auth/homeschool/setup/route';
import { createSupabaseServerClient, createSupabaseServiceClient } from '../src/lib/supabase/server';
jest.mock('../src/lib/auth/bootstrap-profile',()=>({ensureBootstrapProfile:jest.fn(async()=>({error:null}))}));
jest.mock('../src/lib/supabase/server',()=>({createSupabaseServerClient:jest.fn(),createSupabaseServiceClient:jest.fn()}));

const req=(action:string,data:unknown)=>new NextRequest('http://localhost/api/auth/homeschool/setup',{method:'POST',body:JSON.stringify({action,data})});
function setup(parent:unknown, signedIn=true) {
  const writes: Array<{table:string,operation:string,value:any}>=[];
  const client=(admin:boolean)=>({
    auth:{getUser:async()=>({data:{user:signedIn?{id:'parent'}:null},error:null}),admin:{createUser:async()=>({data:{user:{id:'child'}},error:null})}},
    from:(table:string)=>{
      const chain:any={
        select:()=>chain,eq:()=>chain,
        insert:(value:unknown)=>{writes.push({table,operation:'insert',value});return chain;},
        update:(value:unknown)=>{writes.push({table,operation:'update',value});return chain;},
        single:async()=>({data:!admin&&table==='profiles'?parent:{id:table==='organisations'?'org':table==='organisation_units'?'unit':'family'},error:null}),
        then:(resolve:any)=>resolve({data:null,error:null}),
      }; return chain;
    },
  });
  (createSupabaseServerClient as jest.Mock).mockReturnValue(client(false));
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(client(true));
  return writes;
}
it('denies unauthenticated provisioning without writes',async()=>{
  const writes=setup(null,false);expect((await POST(req('create_family',{}))).status).toBe(401);expect(writes).toEqual([]);
});
it('denies students, already-affiliated accounts and another family ID',async()=>{
  for(const [parent,action,data,status] of [
    [{role:'student'},'create_family',{},403],
    [{role:'teacher',organisation_id:'existing'},'create_family',{},409],
    [{role:'teacher',is_primary_parent:true,family_id:'own',organisation_id:'org'},'add_students',{familyId:'victim',students:[]},403],
  ] as const) {
    const writes=setup(parent);expect((await POST(req(action,data))).status).toBe(status);expect(writes).toEqual([]);
  }
});
it('creates a family for the verified user with server-selected role and organisation',async()=>{
  const writes=setup({user_id:'parent',role:'teacher',organisation_id:null});
  const response=await POST(req('create_family',{familyName:'Example',firstName:'Sam',lastName:'Example',userId:'victim',role:'super_admin',organisation_id:'victim-org'}));
  expect(response.status).toBe(200);
  expect(writes.find(w=>w.table==='profiles')?.value).toEqual(expect.objectContaining({role:'teacher',active_role:'teacher',organisation_id:'org',family_id:'family'}));
  expect(writes.find(w=>w.table==='homeschool_family_info')?.value.primary_parent_id).toBe('parent');
});
it('adds students only to the verified family and inherits its actual paid status',async()=>{
  const writes=setup({user_id:'parent',role:'teacher',is_primary_parent:true,family_id:'own',organisation_id:'org',organisation_unit_id:'unit',paid:false});
  const response=await POST(req('add_students',{students:[{firstName:'Child',gradeLevel:'4'}],paid:true}));
  expect(response.status).toBe(200);
  expect(writes.find(w=>w.table==='profiles'&&w.operation==='insert')?.value).toEqual(expect.objectContaining({role:'student',family_id:'own',parent_account_id:'parent',paid:false,is_sub_account:true}));
});
