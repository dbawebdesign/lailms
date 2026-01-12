# Vercel Build Error Fixes

## Date: January 12, 2026

## Issues Fixed

### 1. Auth Session Missing Errors During Build

**Problem:**
```
Auth error or no user: Error [AuthSessionMissingError]: Auth session missing!
```

**Root Cause:**
Server components in Next.js 15 were calling `auth.getUser()` during static generation at build time, when no auth session exists. This caused the build to fail.

**Solution:**
Added `export const dynamic = 'force-dynamic';` to all server component pages that use authentication. This forces Next.js to render these pages dynamically at request time instead of statically at build time.

**Files Modified:**

#### Layouts:
- `src/app/(app)/layout.tsx`

#### Teacher Pages:
- `src/app/(app)/teach/page.tsx`
- `src/app/(app)/teach/knowledge-base/[baseClassId]/page.tsx`
- `src/app/(app)/teach/instances/[instanceId]/page.tsx`
- `src/app/(app)/teach/instances/[instanceId]/settings/page.tsx`
- `src/app/(app)/teach/tools/page.tsx`
- `src/app/(app)/teach/tools/library/page.tsx`
- `src/app/(app)/teach/tools/library/[id]/page.tsx`
- `src/app/(app)/teach/tools/[toolId]/library/page.tsx`
- `src/app/(app)/teach/knowledge/page.tsx`
- `src/app/(app)/teach/knowledge-base/create/page.tsx`
- `src/app/(app)/teach/base-classes/[baseClassId]/page.tsx`
- `src/app/(app)/teach/gradebook/page.tsx` (already client component, no change needed)

#### Organization Pages:
- `src/app/(app)/school/page.tsx`
- `src/app/(app)/org/page.tsx`

#### Student Pages:
- `src/app/(app)/learn/courses/[courseId]/page.tsx`
- `src/app/(app)/learn/notebook/page.tsx` (already client component, no change needed)

#### Homeschool Pages:
- `src/app/(app)/homeschool/page.tsx`
- `src/app/(app)/homeschool/add-students/page.tsx` (already client component, no change needed)

**Total Pages Fixed:** 15 server component pages + 1 layout

### 2. Next.js Security Vulnerability (CVE-2025-66478)

**Problem:**
```
Error: Vulnerable version of Next.js detected, please update immediately.
Learn More: https://vercel.link/CVE-2025-66478
```

**Root Cause:**
The project was using Next.js 15.3.1, which contains a critical security vulnerability (CVE-2025-66478) that allows for remote code execution through the React Server Components (RSC) protocol.

**Solution:**
Updated Next.js and related dependencies to secure versions.

**Files Modified:**
- `package.json`

**Changes:**
```json
// Before:
"next": "15.3.1",
"eslint-config-next": "15.3.1",

// After:
"next": "^15.5.7",
"eslint-config-next": "^15.5.7",
```

**Actual Version Installed:** 15.5.9 (above the minimum patched version of 15.5.7)

## Implementation Pattern

For all server component pages that use authentication, the following pattern was applied:

```typescript
// Add this export at the top of the file, after imports
export const dynamic = 'force-dynamic';

// Then the component definition
export default async function MyPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // ... rest of component
}
```

## Why This Works

1. **Dynamic Rendering:** The `dynamic = 'force-dynamic'` export tells Next.js to render the page on every request, not at build time. This ensures that:
   - Auth cookies are available
   - User sessions can be properly validated
   - No auth errors occur during build

2. **Security Update:** Updating Next.js to 15.5.9:
   - Patches the critical RCE vulnerability
   - Ensures compliance with security best practices
   - Prevents potential exploitation

## Testing

After these changes, the build should:
1. ✅ Complete without auth session errors
2. ✅ Pass Next.js security checks
3. ✅ Deploy successfully to Vercel
4. ✅ Maintain all existing functionality

## Additional Notes

- Client components (marked with `'use client'`) were not affected and didn't need changes
- API routes were not affected as they already run at request time
- The middleware already handles auth correctly and didn't need changes

## Deployment Checklist

Before deploying:
- [x] All server component pages with auth have `dynamic = 'force-dynamic'`
- [x] Next.js updated to 15.5.9
- [x] Dependencies installed successfully
- [ ] Local build test passes: `npm run build`
- [ ] Deploy to Vercel

## Security Recommendations

Given that the vulnerability was present:
1. Consider rotating sensitive API keys and secrets
2. Review access logs for any suspicious activity
3. Monitor for any unusual behavior post-deployment

## References

- [Next.js CVE-2025-66478 Security Advisory](https://nextjs.org/blog/CVE-2025-66478)
- [Next.js Dynamic Rendering Documentation](https://nextjs.org/docs/app/building-your-application/rendering/server-components#dynamic-rendering)
