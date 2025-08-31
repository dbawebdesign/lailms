-- Script to check migration status and identify accounts needing migration

-- 1. Count total users with .internal emails (need migration)
SELECT 
  'Users needing migration' as metric,
  COUNT(*) as count
FROM auth.users 
WHERE email LIKE '%@%.internal';

-- 2. Break down by organization
SELECT 
  o.name as organization,
  o.organisation_type,
  COUNT(u.id) as users_to_migrate
FROM auth.users u
JOIN profiles p ON u.id = p.user_id
JOIN organisations o ON p.organisation_id = o.id
WHERE u.email LIKE '%@%.internal'
GROUP BY o.id, o.name, o.organisation_type
ORDER BY users_to_migrate DESC;

-- 3. Check by role
SELECT 
  p.role,
  COUNT(*) as count
FROM auth.users u
JOIN profiles p ON u.id = p.user_id
WHERE u.email LIKE '%@%.internal'
GROUP BY p.role
ORDER BY count DESC;

-- 4. Sample of accounts needing migration
SELECT 
  u.id,
  u.email,
  p.username,
  p.first_name,
  p.last_name,
  p.role,
  o.name as organization,
  o.organisation_type
FROM auth.users u
JOIN profiles p ON u.id = p.user_id
JOIN organisations o ON p.organisation_id = o.id
WHERE u.email LIKE '%@%.internal'
LIMIT 20;

-- 5. Check migration progress (after migrations start)
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_minutes_to_complete
FROM account_migrations
GROUP BY status;

-- 6. Find homeschool teachers who need family structure setup
SELECT 
  u.id,
  p.username,
  p.first_name,
  p.last_name,
  o.name as organization,
  COUNT(DISTINCT s.user_id) as student_count
FROM auth.users u
JOIN profiles p ON u.id = p.user_id
JOIN organisations o ON p.organisation_id = o.id
LEFT JOIN profiles s ON s.organisation_id = o.id AND s.role = 'student'
WHERE u.email LIKE '%@%.internal'
  AND p.role = 'teacher'
  AND o.organisation_type IN ('individual_family', 'homeschool_coop')
GROUP BY u.id, p.username, p.first_name, p.last_name, o.name
ORDER BY student_count DESC;

-- 7. Check for any existing family structures (already migrated)
SELECT 
  hfi.family_name,
  COUNT(fs.student_id) as student_count,
  p.first_name || ' ' || p.last_name as primary_parent,
  u.email as parent_email
FROM homeschool_family_info hfi
JOIN profiles p ON hfi.primary_parent_id = p.user_id
JOIN auth.users u ON p.user_id = u.id
LEFT JOIN family_students fs ON hfi.id = fs.family_id
WHERE u.email NOT LIKE '%@%.internal'
GROUP BY hfi.id, hfi.family_name, p.first_name, p.last_name, u.email
ORDER BY student_count DESC;

-- 8. Data integrity check - ensure all users have profiles
SELECT 
  'Users without profiles' as issue,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL;

-- 9. Check for duplicate usernames that might cause issues
SELECT 
  username,
  COUNT(*) as count,
  array_agg(organisation_id) as orgs
FROM profiles
WHERE username IS NOT NULL
GROUP BY username
HAVING COUNT(*) > 1
ORDER BY count DESC;
