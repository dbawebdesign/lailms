import { Tables } from 'packages/types/db';

// Export types for use in other files
export type UserProfile = Tables<'profiles'>;
export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent';

// Type guard to check if a string is a valid UserRole
export function isValidUserRole(role: string): role is UserRole {
  return ['super_admin', 'admin', 'teacher', 'student', 'parent'].includes(role);
}

// Type for profile with only role-related fields (useful for API responses)
export type ProfileWithRoles = Pick<UserProfile, 'role' | 'active_role' | 'additional_roles' | 'user_id'>;

// Type for role switching operations
export interface RoleSwitchContext {
  currentRole: UserRole;
  availableRoles: UserRole[];
  hasMultipleRoles: boolean;
}

/**
 * Get the effective role for a user, considering role switching
 * @param profile - User profile from database
 * @returns The active role if set, otherwise the primary role
 */
export function getEffectiveRole(profile: UserProfile | null): UserRole | null {
  if (!profile) return null;
  return (profile.active_role as UserRole) || (profile.role as UserRole);
}

/**
 * Check if user has a specific role (considering role switching)
 * @param profile - User profile from database
 * @param requiredRole - The role to check for
 * @returns True if user has the required role
 */
export function hasRole(profile: UserProfile | null, requiredRole: UserRole): boolean {
  const effectiveRole = getEffectiveRole(profile);
  return effectiveRole === requiredRole;
}

/**
 * Check if user has any of the specified roles (considering role switching)
 * @param profile - User profile from database
 * @param requiredRoles - Array of roles to check for
 * @returns True if user has any of the required roles
 */
export function hasAnyRole(profile: UserProfile | null, requiredRoles: UserRole[]): boolean {
  const effectiveRole = getEffectiveRole(profile);
  return effectiveRole ? requiredRoles.includes(effectiveRole) : false;
}

/**
 * Check if user is a teacher (considering role switching)
 * @param profile - User profile from database
 * @returns True if user is currently acting as a teacher
 */
export function isTeacher(profile: UserProfile | null): boolean {
  return hasRole(profile, 'teacher');
}

/**
 * Check if user is an admin (considering role switching)
 * @param profile - User profile from database
 * @returns True if user is currently acting as an admin
 */
export function isAdmin(profile: UserProfile | null): boolean {
  return hasRole(profile, 'admin');
}

/**
 * Check if user is a super admin (considering role switching)
 * @param profile - User profile from database
 * @returns True if user is currently acting as a super admin
 */
export function isSuperAdmin(profile: UserProfile | null): boolean {
  return hasRole(profile, 'super_admin');
}

/**
 * Check if user is a student (considering role switching)
 * @param profile - User profile from database
 * @returns True if user is currently acting as a student
 */
export function isStudent(profile: UserProfile | null): boolean {
  return hasRole(profile, 'student');
}

/**
 * Check if user is a parent (considering role switching)
 * @param profile - User profile from database
 * @returns True if user is currently acting as a parent
 */
export function isParent(profile: UserProfile | null): boolean {
  return hasRole(profile, 'parent');
}

/**
 * Check if user has admin-level permissions (admin or super_admin)
 * @param profile - User profile from database
 * @returns True if user has admin-level permissions
 */
export function hasAdminPermissions(profile: UserProfile | null): boolean {
  return hasAnyRole(profile, ['admin', 'super_admin']);
}

/**
 * Check if user has teacher-level permissions (teacher, admin, or super_admin)
 * @param profile - User profile from database
 * @returns True if user has teacher-level permissions
 */
export function hasTeacherPermissions(profile: UserProfile | null): boolean {
  return hasAnyRole(profile, ['teacher', 'admin', 'super_admin']);
}

/**
 * Get all available roles for a user (primary + additional roles)
 * @param profile - User profile from database
 * @returns Array of all roles the user can switch to
 */
export function getAvailableRoles(profile: UserProfile | null): UserRole[] {
  if (!profile) return [];
  
  const additionalRoles = profile.additional_roles 
    ? (Array.isArray(profile.additional_roles) ? profile.additional_roles as string[] : [])
    : [];
    
  const allRoles = [profile.role as UserRole, ...additionalRoles.filter(isValidUserRole)];
  return [...new Set(allRoles)]; // Remove duplicates
}

/**
 * Get role switching context for a user
 * @param profile - User profile from database
 * @returns Role switching context with current role and available options
 */
export function getRoleSwitchContext(profile: UserProfile | null): RoleSwitchContext | null {
  if (!profile) return null;
  
  const currentRole = getEffectiveRole(profile);
  const availableRoles = getAvailableRoles(profile);
  
  if (!currentRole) return null;
  
  return {
    currentRole,
    availableRoles,
    hasMultipleRoles: availableRoles.length > 1
  };
}

/**
 * Get profile with role switching fields
 * Used in API routes to ensure we fetch the necessary fields
 */
export const PROFILE_ROLE_FIELDS = 'role, active_role, additional_roles, organisation_id, organisation_unit_id, user_id, first_name, last_name'; 