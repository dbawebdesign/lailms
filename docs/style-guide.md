Learnology AI Comprehensive Style Guide
Objective: Craft a clean, modern, premium AI‑First LMS—think Apple/Tesla with a pop of boldness—where every screen, tab, and page feels light, spacious, airy, and flowing, with intuitive UX/UI, seamless AI integration, and full theming for institutions (custom logos, accent colors), in both light and dark modes.

1. Brand Foundations
1.1 Logo
Primary Mark: “Brain‑dot” icon + Learnology AI wordmark.


Lockups:


Horizontal (icon left, wordmark right)


Vertical (icon above wordmark)


Clear Space: ≥ one dot‑height around.


Minimum Size: 32 px height (screen), 0.5 in (print).


1.2 Brand Colors
Default Accent Gradient:

 less
CopyEdit
#FF835D → #E45DE5 → #6B5DE5


Neutral Palette:


Mode
Background
Surface/Card
Text Primary
Text Secondary
Divider
Light
#FFFFFF
#F7F7F7
#1A1A1A
#4A4A4A
#E0E0E0
Dark
#121212
#1E1E1E
#EDEDED
#A0A0A0
#333333




Institution Accent Override
 Each organization supplies a primary accent color to replace the default gradient—used sparingly for buttons, links, and highlights.

2. Design Principles
Light, Spacious, Airy, Flowing


Whitespace: Generous padding (24–32 px) and margins to give components room to breathe.


Fluid Layouts: Flexible grids and cards that expand and contract smoothly with viewport changes.


Gentle Motion: Subtle, flowing transitions (200 ms ease‑in‑out) for collapse/expand, hover states, and modal fades—reinforcing an airy feel.


Simplicity & Clarity


Minimalist interfaces with clear hierarchy and focus on primary actions.


Progressive disclosure of advanced features behind “More” toggles.


Consistency


Reuse component patterns, spacing, and typography across all screens for predictability.


A unified iconography style and consistent color usage.


Intuitive AI Integration


AI controls (chat panel, tips, content generation) sit naturally within the flow—never obstructing core tasks.


Conversational UI elements guide users without overwhelming them.



3. Typography
Role
Font
Weight
Size
Line‑Height
Spacing
H1 / Headline
Inter / SF Pro
700
36 px
44 px
+0.25 px
H2 / Section Title
Inter / SF Pro
600
24 px
32 px
+0.25 px
H3 / Sub‑section
Inter / SF Pro
500
18 px
28 px
0 px
Body Text
Inter / SF Pro
400
16 px
24 px
0 px
Caption / Small
Inter / SF Pro
400
14 px
20 px
0 px


Fallback: system‑ui, -apple‑system, BlinkMacSystemFont, “Segoe UI”, Roboto, sans‑serif.



4. Layout & Grid
12‑Column Responsive Grid (24 px gutters, 16 px outer margins).


Breakpoints:


XS: < 600 px


SM: ≥ 600 px


MD: ≥ 960 px


LG: ≥ 1280 px


XL: ≥ 1920 px


4.1 Dashboard Structure
css
CopyEdit
┌────────────────┬──────────────────────────┬──────────────────┐
│  Left Nav      │  Main Content            │  AI Chat Panel   │
│ (240 px / 64 px│ (flexible, airy layout)  │ (320 px / hidden) │
│  collapsed)    │                          │                  │
└────────────────┴──────────────────────────┴──────────────────┘

Left Nav: 240 px wide; collapse to 64 px icon bar.


AI Panel: 320 px wide; collapse to a slim handle.


Main Content: flex-grow: 1; min‑width: 0.



5. Navigation
5.1 Side Navigation
Collapsed: icons only, with tooltips.


Expanded: icons + labels, grouped by function.


States:


Hover: bg = Accent @ 10%


Active: bg = Accent; text/icon = #FFF


5.2 AI Chat Panel
Anchor: speech‑bubble icon at right edge when collapsed.


Expanded: slides over content (320 px) with semi‑transparent backdrop.


Header: “AI Assistant” + collapse button.


Input: sticky bottom, rounded, spacious (16 px padding).



6. UI Components
6.1 Buttons
Primary:


bg = Accent or gradient


text = #FFF


padding = 12 × 24 px


border‑radius = 8 px


Secondary:


border = Accent 2 px; text = Accent; bg = transparent


Tertiary/Text:


text = Accent; underline on hover


Disabled:


opacity = 40%; no pointer events


6.2 Form Inputs
Fields:


bg = Surface; border = 1 px Divider; border‑radius = 6 px


focus: border = Accent; box‑shadow = 0 0 0 3 px Accent @ 20%


6.3 Cards & Panels
Card:


bg = Surface; border‑radius = 12 px


box‑shadow = 0 1 3 px rgba(0,0,0,0.1)/(0,0,0,0.5)


padding = 24 px


6.4 Tables & Data Grids
Header: bg = Accent @ 10%; text = Accent @ 80%


Row Hover: bg = Accent @ 5%


Pagination: minimal icons



7. Light & Dark Mode
Toggle: header top‑right.


CSS Vars: for colors, shadows, typography.


Transition: 150 ms ease‑in‑out.


css
CopyEdit
:root { --bg: #FFF; --text: #1A1A1A; }
[data-theme="dark"] { --bg: #121212; --text: #EDEDED; }


8. Iconography & Imagery
Icons: 2 px stroke, 24 × 24 px grid, outline style.


States: accent fill when active; neutral when idle.


Illustrations: flat style, accent highlights.



9. Motion & Interaction
Easing: ease‑in‑out (cubic‑bezier(0.4,0.0,0.2,1))


Durations: Short 100 ms | Base 200 ms | Long 300 ms


Use: nav/panel transitions, hover fades, modals.



10. Customization & Theming
Accent Override: override default gradient with institution’s color.


Logo Swap: upload custom logos (header, login).


Fonts: optional font overrides via CSS vars.


Theming API: JSON schema for colors, logos, radii.


json
CopyEdit
{ "colors": { "accent": "#0078D4" }, "logos": { "header": "/logo.svg" } }


11. Dynamic Hyper‑Personalization
Time‑Of‑Day Greetings:


Morning: “Good morning, {firstName}! Let’s start your day off right.”


Afternoon: “Good afternoon, {firstName}! How’s your learning going?”


Evening: “Good evening, {firstName}. Ready to wrap up?”


Activity Prompts:


“You’ve completed 3 of 5 modules—keep it up!”


“3 days since your last session—need a refresher?”


Milestone Celebrations:


“Congrats on mastering {competencyName}! Here’s your badge.”


Contextual Copy: dynamic placeholders ({dueDate}, {streakDays}) updated in real time.


Theming Variables: expose data & templates for runtime rendering.



12. Screen‑Level Simplicity & Intuitive Design
Whitespace & Clarity: every view uses generous padding and margin for an airy feel.


Consistent Patterns: familiar layouts across screens reduce learning curve.


Primary Actions: always prominent, with clear labels and spacing.


Progressive Disclosure: advanced settings hidden until needed.


Feedback: instant visual cues (spinners, toasts, inline errors).


Onboarding: context‑sensitive tooltips and coach marks.



13. Example Dashboard Layout
mathematica
CopyEdit
┌──────────────────┬─────────────────────────────────┬──────────────────┐
│                  │                                 │                  │
│  ◉ Dashboard     │  ┌───────────────────────────┐  │  AI Assistant    │
│  ◉ Courses       │  │ Good morning, Ava!         │  │  ┌────────────┐  │
│  ◉ Analytics     │  │ Today’s Focus:             │  │  │ Chat Window │  │
│  ◉ Settings      │  │ • 3 high‑priority tasks     │  │  └────────────┘  │
│  (collapsed)     │  │ • Next quiz: Apr 30        │  │  [Input Field]  │
│                  │  └───────────────────────────┘  │                  │
└──────────────────┴─────────────────────────────────┴──────────────────┘


14. Implementation Notes
Framework: React/Vue with theme context and CSS variables.


Design Tokens: managed via Style Dictionary or Figma Tokens.


Accessibility: WCAG 2.1 AA compliance, keyboard nav, ARIA roles.


Versioning: sync design tokens and component library releases.



By embracing “light, spacious, airy, and flowing” alongside premium simplicity and powerful AI, Learnology AI delivers an intuitive, deeply personalized learning platform—tailorable to any institution’s brand and learner needs. 