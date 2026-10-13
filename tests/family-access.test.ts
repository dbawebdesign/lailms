import { canManageFamilyStudent } from '../src/lib/auth/family-access';
const parent={user_id:'parent',family_id:'family-a',is_primary_parent:true,is_sub_account:false};
const child={user_id:'child',role:'student',family_id:'family-a',parent_account_id:'parent',is_sub_account:true};
it('permits direct children and same-family students for the primary parent', () => {
  expect(canManageFamilyStudent(parent,child)).toBe(true);
  expect(canManageFamilyStudent(parent,{...child,parent_account_id:'other-parent'})).toBe(true);
});
it('denies different families, adults, ordinary students and unassigned accounts', () => {
  expect(canManageFamilyStudent(parent,{...child,parent_account_id:'other-parent',family_id:'family-b'})).toBe(false);
  expect(canManageFamilyStudent(parent,{...child,role:'admin'})).toBe(false);
  expect(canManageFamilyStudent({...parent,is_sub_account:true},child)).toBe(false);
  expect(canManageFamilyStudent({user_id:'stranger'},{...child,parent_account_id:null,family_id:null})).toBe(false);
});
