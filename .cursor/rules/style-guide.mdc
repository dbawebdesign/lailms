---
description:
globs:
alwaysApply: false
---
This rule summarizes the [Learnology AI Comprehensive Style Guide](mdc:docs/style-guide.md). Refer to the full guide for complete details and examples.

- **Core Principles:**
  - **Goal:** Clean, modern, premium AI-First LMS (Apple/Tesla aesthetic with bold pop).
  - **Feel:** Light, spacious, airy, flowing, intuitive UX/UI.
  - **Key Elements:** Seamless AI integration, full light/dark theming, institution customization (logo, accent).
  - **Refer:** [Design Principles (Section 2)](mdc:docs/style-guide.md#2-design-principles), [Whitespace/Layout (Section 4, 12)](mdc:docs/style-guide.md#4-layout--grid)

- **Brand Colors:**
  - **Default Accent:** Gradient (#FF835D → #E45DE5 → #6B5DE5).
  - **Institution Accent:** Overrides default gradient (used sparingly).
  - **Neutral Palette:** Specific hex codes defined for Light/Dark modes (Background, Surface, Text Primary/Secondary, Divider).
  - **Implementation:** Use CSS variables (`--background`, `--foreground`, `--accent`, etc.) defined in global styles.
  - **Refer:** [Brand Colors (Section 1.2)](mdc:docs/style-guide.md#12-brand-colors), [Light/Dark Mode (Section 7)](mdc:docs/style-guide.md#7-light--dark-mode)

- **Typography:**
  - **Primary Font:** Inter / SF Pro (use `--font-sans` CSS variable).
  - **Scale:** Specific sizes, weights, line-heights, and letter-spacing defined for H1, H2, H3, Body, Caption.
  - **Implementation:** Use tokens defined in [styleGuide.ts](mdc:packages/ui/styleGuide.ts).
  - **Refer:** [Typography (Section 3)](mdc:docs/style-guide.md#3-typography)

- **Layout & Spacing:**
  - **Grid:** 12-column responsive (24px gutters, 16px outer margins).
  - **Breakpoints:** XS (<600), SM (≥600), MD (≥960), LG (≥1280), XL (≥1920).
  - **Whitespace:** Generous padding/margins (target 24px-32px).
  - **Key Dimensions:** Left Nav (240px/64px), AI Panel (320px/hidden).
  - **Implementation:** Use spacing tokens from [styleGuide.ts](mdc:packages/ui/styleGuide.ts) (e.g., `spacing.px16`, `spacing.px24`).
  - **Refer:** [Layout & Grid (Section 4)](mdc:docs/style-guide.md#4-layout--grid), [Dashboard Structure (Section 4.1)](mdc:docs/style-guide.md#41-dashboard-structure)

- **UI Components:**
  - **Buttons:** Defined styles (Primary, Secondary, Tertiary) using Accent/Gradient, specific padding (12x24px), and radius (8px).
  - **Inputs:** Defined styles (Surface bg, Divider border, 6px radius), focus state (Accent border/shadow).
  - **Cards:** Defined styles (Surface bg, 12px radius, 24px padding, specific shadow).
  - **Implementation:** Utilize components from `packages/ui` that adhere to these specs.
  - **Refer:** [UI Components (Section 6)](mdc:docs/style-guide.md#6-ui-components)

- **Motion:**
  - **Easing:** `ease-in-out` (cubic-bezier(0.4,0.0,0.2,1)).
  - **Durations:** Short (100ms), Base (200ms), Long (300ms).
  - **Use:** Subtle transitions for nav, panels, hover, modals.
  - **Refer:** [Motion & Interaction (Section 9)](mdc:docs/style-guide.md#9-motion--interaction)

- **Customization:**
  - Allow institutions to override accent color and logos via CSS variables or a theming mechanism.
  - **Refer:** [Customization & Theming (Section 10)](mdc:docs/style-guide.md#10-customization--theming)

- **Implementation Notes:**
  - Use design tokens from [styleGuide.ts](mdc:packages/ui/styleGuide.ts).
  - Define core CSS variables (colors, fonts, radius) in global styles.
  - Ensure WCAG 2.1 AA accessibility.
  - **Refer:** [Implementation Notes (Section 14)](mdc:docs/style-guide.md#14-implementation-notes)
