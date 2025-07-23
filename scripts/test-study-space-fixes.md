# Study Space Fix Verification Test Plan

## Issues Fixed

1. **One Study Space Per User/Course**: Added unique constraint to prevent multiple study spaces per user/course combination
2. **Content Scoping**: Notes and mind maps are now properly filtered by study_space_id 
3. **Sources Loading**: Course content now loads properly when study spaces are created
4. **Mind Map Saving**: Automatically uses center node as title, no popup prompt

## Test Scenarios

### Test 1: Single Study Space Per Course
**Expected Behavior**: Only one study space should exist per user/course combination

**Steps:**
1. Login as a student
2. Navigate to `/learn/notebook`
3. Select a course from the dropdown
4. Verify a study space is created for that course
5. Navigate away and come back to the same course
6. Verify the same study space is reused (not a new one created)
7. Check database: `SELECT * FROM study_spaces WHERE user_id = 'USER_ID' AND course_id = 'COURSE_ID'` - should return only 1 row

### Test 2: Content Isolation Between Study Spaces
**Expected Behavior**: Notes and mind maps should only appear in their respective study spaces

**Steps:**
1. Create/select study space for Course A
2. Create some notes and mind maps in Course A study space
3. Switch to Course B (different course)
4. Verify that Course A's notes and mind maps are NOT visible in Course B's study space
5. Create different notes/mind maps in Course B
6. Switch back to Course A
7. Verify only Course A's content is visible

### Test 3: Sources Loading
**Expected Behavior**: Course sources (paths, lessons, sections) should load when study space is created

**Steps:**
1. Select a course that has content (paths, lessons, sections)
2. Verify that the Sources panel shows the course content
3. Verify that content items are properly categorized and accessible
4. Switch to a different course
5. Verify that the new course's sources load properly

### Test 4: Mind Map Saving (NEW)
**Expected Behavior**: Mind maps should save automatically using center node as title, without popup

**Steps:**
1. Select a course/study space
2. Go to Mind Maps tab
3. Generate or create a mind map with a specific center node title (e.g., "React Hooks")
4. Click the "Save" button
5. **Verify**: No popup appears asking for a title
6. **Verify**: Success message shows: `Mind map "React Hooks" created successfully!`
7. **Verify**: Mind map appears in "Saved Mind Maps" section with the correct title
8. **Verify**: Console shows: `✅ Mind map created successfully: React Hooks`

### Test 5: Mind Map List View Synchronization (NEW)
**Expected Behavior**: List view should update automatically when nodes are expanded in visual view

**Steps:**
1. Select a course/study space and generate a mind map
2. Switch to "Visual" view mode
3. Click on a node to expand it (add new content)
4. **Verify**: Console shows: `🔄 Mind map updated with new nodes: [details]`
5. Switch to "List" view mode
6. **Verify**: The expanded content appears in the hierarchical list
7. **Verify**: Expanded sections show "📋 Expanded Content (X items)" labels
8. **Verify**: New content follows proper numbering (e.g., 1.1.1, 1.1.2)
9. Switch back to Visual view and expand more nodes
10. Switch to List view again
11. **Verify**: All new expansions are reflected in the list with proper hierarchy

### Test 6: Mind Map Update vs Create (NEW)
**Expected Behavior**: Saving should update existing mind maps instead of creating duplicates

**Steps:**
1. Create and save a new mind map (e.g., "JavaScript Basics")
2. **Verify**: Console shows: `✨ Creating new mind map: JavaScript Basics`
3. **Verify**: Success message: `Mind map "JavaScript Basics" created successfully!`
4. Load the saved mind map from "Saved Mind Maps" section
5. **Verify**: Console shows: `📖 Loaded existing mind map: JavaScript Basics ID: [uuid]`
6. Expand some nodes or modify the mind map
7. Click "Save" button again
8. **Verify**: Console shows: `🔄 Updating existing mind map: JavaScript Basics ID: [uuid]`
9. **Verify**: Success message: `Mind map "JavaScript Basics" updated successfully!`
10. Check "Saved Mind Maps" section - should still show only ONE "JavaScript Basics" entry
11. Test same-title scenario: Create a new mind map with same center node title
12. **Verify**: Console shows: `🔄 Updating mind map with same title: JavaScript Basics ID: [uuid]`

## Database Verification Queries

```sql
-- Check for duplicate study spaces per user/course
SELECT user_id, course_id, COUNT(*) as count 
FROM study_spaces 
WHERE course_id IS NOT NULL 
GROUP BY user_id, course_id 
HAVING COUNT(*) > 1;

-- Should return 0 rows if fix is working

-- Check study space content isolation
SELECT ss.name as study_space_name, 
       COUNT(sn.id) as notes_count,
       COUNT(mm.id) as mindmaps_count
FROM study_spaces ss
LEFT JOIN study_notes sn ON ss.id = sn.study_space_id
LEFT JOIN mind_maps mm ON ss.id = mm.study_space_id
WHERE ss.user_id = 'USER_ID'
GROUP BY ss.id, ss.name;

-- Check mind map titles are using center node labels
SELECT title, map_data->>'center'->>'label' as center_label
FROM mind_maps 
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC;

-- Check for duplicate mind maps (should return 0 rows)
SELECT title, study_space_id, COUNT(*) as count
FROM mind_maps 
WHERE user_id = 'USER_ID'
GROUP BY title, study_space_id
HAVING COUNT(*) > 1;

-- Check mind map update timestamps
SELECT title, created_at, updated_at,
       CASE WHEN updated_at > created_at THEN 'Updated' ELSE 'Original' END as status
FROM mind_maps 
WHERE user_id = 'USER_ID'
ORDER BY updated_at DESC;
```

## Console Log Verification

Look for these log messages in browser console:

### Study Space Creation/Reuse:
- `🔐 User authenticated: [user_id]`
- `📚 Loading study spaces for user: [user_id]`
- `🎯 Course selected: [course_name] Base class ID: [base_class_id]`
- `✅ Found and using existing study space: [space_name]` (when reusing)
- `✅ Created new course-linked study space: [space_name]` (when creating new)

### Content Loading:
- `🔄 Loading content for: [course/space info]`
- `📚 Loading course content for study space: [space_name] Course ID: [course_id]`
- `📝 Loaded [X] notes for study space: [space_id]`
- `🧠 Loaded [X] mind maps for study space: [space_id]`

### Content Isolation:
- `🚫 No study space selected, clearing notes` (when no space selected)
- Notes and mind maps counts should be different for different study spaces

### Mind Map Saving (NEW):
- `✅ Mind map saved successfully: [center_node_title]`

## Success Criteria

✅ **Fix 1 - Single Study Space**: 
- Database query returns 0 duplicate study spaces
- Console shows "Found and using existing study space" on subsequent visits to same course

✅ **Fix 2 - Content Isolation**:
- Notes and mind maps are different between study spaces
- Switching courses shows different content counts
- Database queries show content properly associated with correct study_space_id

✅ **Fix 3 - Sources Loading**:
- Course content appears in Sources panel when study space is created
- Content items are properly loaded and categorized
- Switching courses loads different source content

✅ **Fix 4 - Mind Map Saving**:
- No popup appears when saving mind maps
- Mind map title automatically uses center node label
- Success message shows the correct title
- Saved mind maps appear with correct titles

✅ **Fix 5 - Mind Map List View Synchronization**:
- List view automatically updates when visual mind map is expanded
- All hierarchy levels are displayed (center → branches → concepts → points → details)
- Proper numbering system (1.1.1.1 format)
- Visual indicators show expanded content sections
- Real-time synchronization between visual and list views

✅ **Fix 6 - Mind Map Update vs Create**:
- Existing mind maps are updated instead of creating duplicates
- Mind maps loaded from saved list retain their ID for updates
- Same-title mind maps in same study space are updated, not duplicated
- Clear messaging distinguishes between "created" and "updated" operations
- Database shows proper created_at vs updated_at timestamps

## Rollback Plan

If issues are found:
1. Remove unique constraint: `DROP INDEX unique_study_space_per_user_course;`
2. Revert code changes in `src/app/(app)/learn/notebook/page.tsx`
3. Revert mind map changes in `src/components/study-space/MindMapViewer.tsx`
4. Investigate and fix issues before re-applying 