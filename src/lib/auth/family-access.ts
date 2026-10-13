export type FamilyProfile = {
  user_id: string;
  role?: string | null;
  family_id?: string | null;
  parent_account_id?: string | null;
  is_sub_account?: boolean | null;
  is_primary_parent?: boolean | null;
};

export type FamilyProvisioningProfile = FamilyProfile & {
  organisation_id: string | null;
  organisation_unit_id: string | null;
  paid: boolean | null;
  organisations?: { id: string; name: string; organisation_type: string } | null;
};

// Organisation membership alone never authorizes impersonation of a student.
export function canManageFamilyStudent(parent: FamilyProfile, student: FamilyProfile): boolean {
  return parent.is_sub_account !== true
    && student.is_sub_account === true
    && student.role === 'student'
    && (student.parent_account_id === parent.user_id
      || (parent.is_primary_parent === true && !!parent.family_id && student.family_id === parent.family_id));
}
