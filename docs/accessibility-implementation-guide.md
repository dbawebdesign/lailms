# Accessibility Implementation Guide - Rich Content

This document provides comprehensive guidance for implementing accessible rich content throughout the LearnologyAI application.

## Overview

Our accessibility implementation ensures WCAG 2.1 AA compliance for all rich content including images, tables, modals, and complex interactions. This guide covers the accessible components we've created and how to use them properly.

## Accessible Components

### 1. Enhanced Table Component (`src/components/ui/table.tsx`)

Our table component now includes comprehensive accessibility features:

#### Features:
- **Proper ARIA attributes**: `role="table"`, `aria-label`, `aria-labelledby`, `aria-describedby`
- **Scope attributes**: Automatic `scope="col"` for headers, optional `scope` for cells
- **Keyboard navigation**: Focusable table container with proper tab order
- **Screen reader support**: Table region with descriptive labels
- **Sorting support**: `aria-sort` attribute for sortable columns

#### Usage Examples:

```tsx
// Basic accessible table
<Table aria-label="Student grades">
  <TableCaption>Semester grades for all students</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead scope="col">Student Name</TableHead>
      <TableHead scope="col" aria-sort="ascending">Grade</TableHead>
      <TableHead scope="col">Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell scope="row">John Doe</TableCell>
      <TableCell>A+</TableCell>
      <TableCell>Passed</TableCell>
    </TableRow>
  </TableBody>
</Table>

// Complex table with descriptions
<Table 
  aria-labelledby="grade-table-title"
  aria-describedby="grade-table-desc"
>
  <TableCaption id="grade-table-title">
    Final Grades - Fall 2024
  </TableCaption>
  <div id="grade-table-desc" className="sr-only">
    This table shows final grades for all students in the course, 
    sorted by grade in ascending order.
  </div>
  {/* ... table content */}
</Table>
```

### 2. Accessible Image Components (`src/components/ui/accessible-image.tsx`)

Three specialized image components for different use cases:

#### AccessibleImage Component

```tsx
// Informative image (default)
<AccessibleImage 
  src="/path/to/image.jpg"
  alt="Chart showing 25% increase in student performance"
  width={400}
  height={300}
/>

// Decorative image
<AccessibleImage 
  src="/path/to/decoration.jpg"
  alt=""
  imageType="decorative"
  width={200}
  height={100}
/>

// Complex image with description
<AccessibleImage 
  src="/path/to/complex-chart.jpg"
  alt="Sales performance chart"
  imageType="complex"
  aria-describedby="chart-description"
  width={600}
  height={400}
/>
<div id="chart-description" className="sr-only">
  Detailed description: This chart shows quarterly sales data...
</div>
```

#### AccessibleFigure Component

```tsx
<AccessibleFigure 
  caption="Figure 1: Student engagement trends over time"
  className="my-4"
>
  <AccessibleImage 
    src="/charts/engagement.png"
    alt="Line chart showing increasing student engagement"
    width={500}
    height={300}
  />
</AccessibleFigure>
```

#### AccessibleAvatar Component

```tsx
<AccessibleAvatar 
  src="/avatars/student.jpg"
  userName="Jane Smith"
  showOnlineStatus={true}
  isOnline={true}
  width={40}
  height={40}
/>
```

### 3. Accessible Modal Component (`src/components/ui/accessible-modal.tsx`)

Comprehensive modal implementation with proper focus management:

#### Features:
- **Focus trapping**: Keeps focus within modal during interaction
- **Focus restoration**: Returns focus to trigger element on close
- **Keyboard navigation**: Escape to close, Tab cycling
- **ARIA attributes**: `role="dialog"`, `aria-modal`, `aria-labelledby`
- **Backdrop interaction**: Configurable overlay click behavior
- **Size variants**: Multiple size options for different content

#### Usage Examples:

```tsx
import { AccessibleModal, useAccessibleModal } from '@/components/ui/accessible-modal'

function MyComponent() {
  const { isOpen, open, close } = useAccessibleModal()
  
  return (
    <>
      <Button onClick={open}>Open Settings</Button>
      
      <AccessibleModal
        isOpen={isOpen}
        onClose={close}
        title="User Settings"
        description="Manage your account preferences and settings"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" />
          </div>
          <div>
            <Label htmlFor="notifications">Notifications</Label>
            <Switch id="notifications" />
          </div>
        </div>
        
        <AccessibleModalFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </AccessibleModalFooter>
      </AccessibleModal>
    </>
  )
}
```

## Implementation Guidelines

### Images

1. **Always provide alt text**: Every image must have meaningful alt text or be marked as decorative
2. **Use appropriate image types**:
   - `informative`: Standard images that convey information
   - `decorative`: Pure decoration (alt="", aria-hidden)
   - `complex`: Charts, graphs, diagrams needing detailed descriptions
3. **Provide text alternatives**: For complex images, include detailed descriptions
4. **Use figure elements**: Wrap images with captions in `AccessibleFigure`

### Tables

1. **Use table captions**: Provide context with `TableCaption`
2. **Proper header structure**: Use `TableHead` with appropriate `scope` attributes
3. **Row headers**: Use `scope="row"` for row header cells
4. **Sorting indicators**: Include `aria-sort` for sortable columns
5. **Table descriptions**: Use `aria-describedby` for complex tables

### Modals and Dialogs

1. **Proper labeling**: Always provide `title` and optional `description`
2. **Focus management**: Use `initialFocusRef` and `finalFocusRef` when needed
3. **Keyboard support**: Ensure Escape key closes modal
4. **Backdrop behavior**: Configure overlay click behavior appropriately
5. **Content structure**: Use semantic HTML within modal content

### Forms in Rich Content

1. **Label associations**: Every form control must have associated labels
2. **Error handling**: Use `aria-describedby` for error messages
3. **Required fields**: Mark with `aria-required="true"`
4. **Field descriptions**: Provide help text with proper associations

## Testing Guidelines

### Automated Testing

```javascript
// Example accessibility test
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

test('AccessibleModal should be accessible', async () => {
  const { container } = render(
    <AccessibleModal 
      isOpen={true}
      onClose={() => {}}
      title="Test Modal"
    >
      <p>Modal content</p>
    </AccessibleModal>
  )
  
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### Manual Testing

1. **Keyboard navigation**: Test all interactions with keyboard only
2. **Screen reader testing**: Use NVDA, JAWS, or VoiceOver
3. **Focus management**: Verify focus moves logically
4. **Color contrast**: Ensure 4.5:1 ratio for normal text
5. **Zoom testing**: Test at 200% zoom level

## Best Practices

### General Principles

1. **Semantic HTML first**: Use proper HTML elements before adding ARIA
2. **Progressive enhancement**: Ensure functionality without JavaScript
3. **Consistent patterns**: Use established patterns across the application
4. **User testing**: Include users with disabilities in testing process

### Content Guidelines

1. **Clear language**: Use simple, clear language in all content
2. **Logical structure**: Organize content with proper heading hierarchy
3. **Alternative formats**: Provide multiple ways to access information
4. **Error prevention**: Design to prevent user errors

### Technical Implementation

1. **ARIA landmarks**: Use proper landmark roles for page structure
2. **Live regions**: Implement for dynamic content updates
3. **Focus indicators**: Ensure visible focus indicators
4. **Animation controls**: Provide controls for motion-sensitive users

## Compliance Checklist

### WCAG 2.1 AA Requirements

- ✅ **1.1.1 Non-text Content**: All images have appropriate alt text
- ✅ **1.3.1 Info and Relationships**: Proper semantic structure
- ✅ **1.4.3 Contrast**: 4.5:1 color contrast ratio maintained
- ✅ **2.1.1 Keyboard**: All functionality available via keyboard
- ✅ **2.1.2 No Keyboard Trap**: Focus can move away from all components
- ✅ **2.4.1 Bypass Blocks**: Skip navigation links implemented
- ✅ **2.4.3 Focus Order**: Logical focus order maintained
- ✅ **2.4.6 Headings and Labels**: Descriptive headings and labels
- ✅ **3.2.2 On Input**: No unexpected context changes
- ✅ **4.1.2 Name, Role, Value**: Proper ARIA implementation
- ✅ **4.1.3 Status Messages**: Live regions for dynamic content

## Resources

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)

### Testing Tools
- [axe-core](https://github.com/dequelabs/axe-core)
- [WAVE Web Accessibility Evaluator](https://wave.webaim.org/)
- [Lighthouse Accessibility Audit](https://developers.google.com/web/tools/lighthouse)

### Screen Readers
- [NVDA](https://www.nvaccess.org/) (Windows, free)
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) (Windows)
- [VoiceOver](https://www.apple.com/accessibility/mac/vision/) (macOS, built-in)

---

*This guide is part of our ongoing commitment to digital accessibility and inclusive design. For questions or suggestions, please contact the development team.* 