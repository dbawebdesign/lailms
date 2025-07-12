# Current Supabase Schema - Updated for Role Switching Support

This document tracks the current state of our Supabase database schema, including all recent updates to support role switching functionality.

## Profile System with Role Switching

### Core Role Fields
- `role` (enum): Primary user role assigned during signup
- `active_role` (enum): Currently active role for role switching (nullable)
- `additional_roles` (text[]): Array of roles user can switch between

### Effective Role Calculation
All application logic and RLS policies now use: `COALESCE(active_role, role)` as the effective role.

### Role Switching Trigger
```sql
-- Trigger ensures active_role can only be set to roles in additional_roles array
CREATE OR REPLACE FUNCTION check_active_role_allowed()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow setting active_role to null (revert to primary role)
  IF NEW.active_role IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if active_role is in additional_roles array
  IF NEW.active_role = ANY(NEW.additional_roles) THEN
    RETURN NEW;
  END IF;
  
  -- Reject if active_role not in additional_roles
  RAISE EXCEPTION 'Active role % is not in additional_roles array', NEW.active_role;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_active_role 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION check_active_role_allowed();
```

## Updated RLS Policies (Migration: update_rls_policies_for_role_switching)

All RLS policies have been updated to use the effective role pattern. Key updates include:

### Admin/Super Admin Policies
- `agent_performance_summary`: Admin viewing rights
- `feedback_support`: Admin management and viewing
- `homeschool_family_info`: Admin management within organization
- `invite_codes`: Organization admin management

### Teacher Policies
- `paths`: Creator and organization teacher/admin access
- `standards`: Teacher management within organization
- `lessons`: Complex multi-role access patterns

### Effective Role Pattern
All policies now use:
```sql
COALESCE(profiles.active_role, profiles.role) = 'target_role'::role
-- or for multiple roles:
COALESCE(profiles.active_role, profiles.role) = ANY (ARRAY['role1'::role, 'role2'::role])
```

## Application Layer Updates

### Centralized Role Checking
- `lib/utils/roleUtils.ts`: All role checking functions updated
- `isTeacher()`, `isAdmin()`, `isSuperAdmin()`, `hasTeacherPermissions()`
- `getEffectiveRole()`: Returns `active_role || role`

### Database Query Pattern
All database queries use:
```sql
SELECT id, email, full_name, role, active_role, additional_roles,
       COALESCE(active_role, role) as effective_role
FROM profiles 
WHERE user_id = $1;
```

### API Endpoints
All API routes updated to use centralized role checking functions instead of hardcoded `profile.role` checks.

## Role Switching UI Components

### Role Switching Hook
```typescript
// hooks/useRoleSwitch.ts
const useRoleSwitch = () => {
  const switchRole = async (newRole: UserRole | null) => {
    // Updates active_role field and refreshes page
  };
  return { switchRole, availableRoles, currentRole };
};
```

### Navigation Updates
- Header component shows role switcher for users with multiple roles
- Navigation items respect effective role permissions
- Full page refresh on role switch to update server-side layouts

## Security Considerations

### RLS Policy Coverage
✅ All policies updated to respect role switching
✅ No hardcoded role checks remain in database layer
✅ Effective role pattern consistently applied

### Application Layer Coverage  
✅ All API endpoints use centralized role checking
✅ All page components use role utility functions
✅ All database queries use effective role pattern

### Type Safety
✅ Consistent `UserRole` and `UserProfile` type exports
✅ No import conflicts between role definitions

## Testing Verification

The role switching system has been verified to work across:
- Database RLS policies (all updated)
- API endpoint permissions (all use centralized functions)
- UI component access control (all use role utilities)
- Navigation and routing (respects effective role)

## Future Maintenance

When adding new features:
1. **RLS Policies**: Use `COALESCE(profiles.active_role, profiles.role)` pattern
2. **API Endpoints**: Use functions from `lib/utils/roleUtils.ts`
3. **UI Components**: Use centralized role checking hooks/utilities
4. **Database Queries**: Include effective role calculation in SELECT statements

This ensures role switching continues to work seamlessly across all parts of the application. 