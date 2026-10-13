/** @jest-environment node */
import { ensureBootstrapProfile } from '../src/lib/auth/bootstrap-profile';
import { createSupabaseServiceClient } from '../src/lib/supabase/server';
jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('../src/lib/supabase/server',()=>({createSupabaseServiceClient:jest.fn()}));
it('never trusts user metadata for role, paid status or organisation and preserves existing rows',async()=>{
  const upsert=jest.fn(async()=>({error:null}));
  (createSupabaseServiceClient as jest.Mock).mockReturnValue({from:()=>({upsert})});
  await ensureBootstrapProfile({id:'verified-user',user_metadata:{username:'New.User',role:'super_admin',paid:true,organisation_id:'victim'}} as any);
  expect(upsert).toHaveBeenCalledWith({user_id:'verified-user',username:'new.user',role:'teacher',active_role:'teacher'},{onConflict:'user_id',ignoreDuplicates:true});
});
