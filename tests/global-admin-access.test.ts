/** @jest-environment node */
import { PLATFORM_ADMIN_USER_ID } from '../src/lib/auth/platform-admin';
import { requireGlobalAdmin } from '../src/lib/auth/require-global-admin';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
jest.mock('../src/lib/supabase/server',()=>({createSupabaseServerClient:jest.fn()}));
it.each([
  ['anonymous',null,401],
  ['ordinary user',{id:'user',app_metadata:{}},403],
  ['organisation super admin',{id:'user',app_metadata:{role:'super_admin'}},403],
  ['forged user metadata',{id:'user',user_metadata:{platform_admin:true},app_metadata:{}},403],
  ['string claim',{id:'user',app_metadata:{platform_admin:'true'}},403],
  ['another platform admin',{id:'other-user',app_metadata:{platform_admin:true}},403],
  ['owner without designation',{id:PLATFORM_ADMIN_USER_ID,app_metadata:{}},403],
  ['owner with forged user metadata',{id:PLATFORM_ADMIN_USER_ID,user_metadata:{platform_admin:true},app_metadata:{}},403],
  ['owner string claim',{id:PLATFORM_ADMIN_USER_ID,app_metadata:{platform_admin:'true'}},403],
  ['designated owner',{id:PLATFORM_ADMIN_USER_ID,app_metadata:{platform_admin:true}},null],
])('%s has the expected survey access',async(_label,user,status)=>{
  (createSupabaseServerClient as jest.Mock).mockReturnValue({
    auth:{getUser:async()=>({data:{user},error:null})},
  });
  expect((await requireGlobalAdmin())?.status ?? null).toBe(status);
});
