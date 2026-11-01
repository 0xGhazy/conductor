# Frontend Engineering Guidelines

Every developer and AI agent must follow these rules when working inside the React frontend workspace.

The frontend must remain:

- reusable
- consistent
- maintainable
- scalable
- predictable
- accessible
- easy to extend
- aligned with the existing project architecture

Do not optimize only for completing the current task quickly.

Always consider the long-term structure of the frontend.

---

# 1. Directory Structure

Use the following frontend structure:

```text
frontend/
├── public/
│   └── Static assets served directly
│
└── src/
    ├── assets/
    │   ├── images/
    │   ├── icons/
    │   └── fonts/
    │
    ├── components/
    │   ├── common/
    │   └── layout/
    │
    ├── features/
    │   ├── auth/
    │   ├── dashboard/
    │   └── tenants/
    │
    ├── pages/
    │   ├── Home/
    │   └── Dashboard/
    │
    ├── routes/
    │   ├── AppRoutes.tsx
    │   └── ProtectedRoute.tsx
    │
    ├── hooks/
    ├── context/
    ├── store/
    ├── services/
    ├── utils/
    ├── types/
    ├── styles/
    │   ├── globals.css
    │   └── variables.css
    │
    ├── config/
    ├── App.tsx
    └── main.tsx
```

The exact contents may evolve, but new code must follow the same architectural boundaries.

---

# 2. Feature-Based Architecture

Code inside:

```text
src/features/
```

must be organized by business feature or domain.

Example:

```text
features/
└── auth/
    ├── components/
    ├── hooks/
    ├── services/
    ├── types/
    ├── utils/
    └── index.ts
```

Prefer feature-based organization over grouping all components globally by technical type.

A feature should own its domain-specific:

- components
- hooks
- services
- types
- validators
- utilities
- state

when those pieces are specific to that feature.

---

# 3. Feature Isolation

Direct feature-to-feature imports are prohibited.

Do not do:

```typescript
import Something from '@/features/auth/...';
```

inside another unrelated feature such as:

```text
features/tenants/
```

If multiple features need the same logic or component, move it to an appropriate shared location.

Examples:

```text
src/components/common/
src/hooks/
src/services/
src/utils/
src/types/
```

Shared code must not belong to one feature semantically.

---

# 4. Shared Components

Reusable application-wide UI components belong under:

```text
src/components/common/
```

Examples:

```text
Button
TextField
Select
Autocomplete
Checkbox
Switch
Modal
Dialog
Loader
EmptyState
Tooltip
Pagination
```

Recommended structure:

```text
Button/
├── Button.tsx
├── Button.module.css
├── Button.test.tsx
└── index.ts
```

Shared components should be generic and must not contain feature-specific business knowledge.

A reusable component should not know about:

```text
HTTP nodes
database nodes
tenant-specific APIs
workflow names
domain-specific response formats
```

---

# 5. Reuse Before Creating

Before creating any new:

- component
- hook
- utility
- field
- validator
- formatter
- dialog
- button
- modal
- form abstraction
- styling helper
- state helper

search the repository for an existing equivalent or similar implementation.

Follow this order:

```text
1. Reuse an existing implementation as-is
2. Extend an existing implementation if the new behavior is generic
3. Compose existing components
4. Generalize an existing feature-specific implementation when appropriate
5. Create something new only when no suitable abstraction exists
```

Creating duplicate functionality when a reusable implementation already exists is considered a defect.

---

# 6. Search Before Implementation

Before implementing any frontend task, inspect the relevant existing code.

For example, before creating a text field, search for:

```text
TextField
Input
FormField
Controller
FormControl
```

Before creating a dialog:

```text
Dialog
Modal
Drawer
ConfirmationDialog
```

Before creating buttons:

```text
Button
IconButton
LoadingButton
```

Before creating form behavior:

```text
useForm
Controller
register
validation
```

Do not assume that an abstraction does not exist.

---

# 7. Avoid Duplicate UI Abstractions

Do not introduce several components that solve substantially the same problem.

Avoid situations such as:

```text
AppTextField
FormTextField
CustomTextField
NodeTextField
CommonInput
TextInput
```

unless they genuinely have distinct responsibilities.

When similar components already exist, compare:

- API
- styling
- validation behavior
- form integration
- accessibility
- error handling
- loading states
- read-only states
- usage locations

before introducing another abstraction.

---

# 8. Prefer Existing Project Components Over Raw Library Usage

When the project already provides a reusable abstraction, use it.

Example:

Prefer:

```tsx
<WeaverTextField />
```

over:

```tsx
<TextField />
```

when the shared field already supports the required behavior.

Direct MUI or third-party component usage is acceptable when:

- no project abstraction exists
- the use case is genuinely unique
- wrapping it would create unnecessary abstraction
- the project abstraction does not support the required behavior and should not be generalized

Do not bypass project abstractions simply because direct library usage is faster.

---

# 9. Do Not Over-Abstract

Reusability does not mean everything must become shared.

Do not create a reusable component merely because two blocks of code look slightly similar.

Keep components separate when:

- their domain behavior is meaningfully different
- reuse would require many conditional flags
- the shared API would become confusing
- they have different lifecycle requirements
- they have different validation or state behavior

Avoid giant components such as:

```tsx
<Input
  isSearch
  isPassword
  isNodeField
  isDatabaseField
  isHttpField
  showExpression
  showCopy
  specialMode
/>
```

Prefer composition and focused responsibilities.

---

# 10. Prefer Composition

Build reusable primitives and compose them together.

Prefer:

```text
BaseTextField
    +
Form Integration
    +
Expression Support
```

over one large component handling every possible context.

Shared primitives should stay simple.

Feature-specific behavior should be layered on top.

---

# 11. Common Component API Consistency

Shared components should follow consistent prop naming.

Prefer:

```text
label
name
value
onChange
error
helperText
disabled
readOnly
required
placeholder
options
loading
```

Avoid introducing alternative names such as:

```text
title instead of label
validationError instead of error
message instead of helperText
readonly instead of readOnly
items instead of options
```

unless the existing project has an established convention.

If similar components already expose conflicting APIs, prefer consolidation instead of adding another variation.

---

# 12. Forms

Follow the project's established form architecture.

If the codebase standardizes on React Hook Form, reuse that approach.

Do not mix different form patterns inside equivalent workflows without a strong reason.

Avoid unnecessary combinations of:

```text
useState
React Hook Form
manual validation
custom form state
```

Shared form components should handle consistent:

- validation
- errors
- required state
- disabled state
- default values
- reset behavior
- helper text
- submission state

---

# 13. Colocation

Keep files that belong to one component together.

Example:

```text
UserCard/
├── UserCard.tsx
├── UserCard.module.css
├── UserCard.test.tsx
└── index.ts
```

Colocate:

- component
- local styling
- tests
- local helper functions
- component-specific types

Do not scatter one component's implementation unnecessarily across unrelated folders.

---

# 14. Styling

Preferred styling approaches:

```text
Vanilla CSS
CSS Modules
```

Use:

```text
*.module.css
```

for component-level styling when appropriate.

Do not introduce TailwindCSS unless explicitly requested.

Avoid uncontrolled global CSS.

---

# 15. Shared Styling and Design Tokens

Common visual values must be centralized where practical.

Use:

```text
src/styles/variables.css
```

or the project's equivalent design-token file.

Centralize recurring values such as:

```text
colors
spacing
border radii
font sizes
shadows
transitions
field heights
z-index layers
```

Do not repeatedly hardcode the same values across features.

---

# 16. Avoid Styling Duplication

Before adding repeated CSS or `sx` configuration, check whether styling already exists in:

- common components
- global variables
- theme configuration
- CSS modules
- shared layouts

Avoid duplicating identical rules for:

```text
input borders
label styling
focus state
error state
disabled state
button height
border radius
spacing
```

---

# 17. MUI Styling

If MUI is used in the project, do not repeatedly apply identical `sx` rules across screens.

Prefer:

```text
shared component abstraction
theme customization
reusable style helper
```

when the styling is common.

Local `sx` usage is acceptable for truly local layout adjustments.

---

# 18. Typography

Do not rely on browser default fonts.

Use the project's approved typography system.

If a global font already exists, reuse it.

Do not introduce a new font for an individual feature without an explicit design requirement.

When adding typography globally, use a modern web font such as:

```text
Inter
Outfit
```

or the project's established equivalent.

Font assets should preferably be centralized rather than repeatedly imported by individual components.

---

# 19. Icons

Use the project's established icon library consistently.

If React Icons is the standard, use:

```text
react-icons
```

before introducing another icon package.

Do not mix several icon libraries without justification.

Reuse existing application-specific icons from:

```text
src/assets/icons/
```

when appropriate.

---

# 20. Visual Quality

UI implementations should feel intentional and cohesive.

Use:

- consistent spacing
- appropriate hover feedback
- clear focus states
- smooth transitions
- consistent border radius
- readable typography
- sensible contrast
- proper loading states
- responsive layouts

Avoid decorative effects merely for visual complexity.

Effects such as:

```text
glassmorphism
vibrant highlights
strong shadows
gradients
```

should only be used when consistent with the application's existing design language.

Do not force them into every component.

---

# 21. Transitions

Use transitions intentionally.

Do not blindly use:

```css
transition: all 0.2s ease;
```

for every component.

Prefer transitioning only the properties that actually change.

Example:

```css
transition:
  background-color 0.2s ease,
  border-color 0.2s ease,
  box-shadow 0.2s ease;
```

This improves predictability and performance.

---

# 22. Dark and Light Mode

When the application supports themes, shared components must behave consistently in both modes.

Avoid hardcoding colors that make theme switching difficult.

Prefer design tokens or theme variables.

---

# 23. Hooks

Before creating a new hook, search for an existing implementation.

Avoid duplicating hooks for:

```text
debouncing
pagination
query parameters
API loading state
authentication
permissions
local storage
responsive state
form synchronization
```

A shared hook should contain reusable behavior, not feature-specific business logic.

Feature-specific hooks belong inside the corresponding feature.

---

# 24. Utilities

Before introducing a helper function, search existing utilities.

Do not duplicate helpers for:

```text
date formatting
string formatting
number formatting
validation
URL construction
JSON handling
sorting
filtering
mapping
```

Generic utilities belong in:

```text
src/utils/
```

Feature-specific utilities remain inside the feature.

---

# 25. Services

Global HTTP configuration belongs under:

```text
src/services/
```

Examples:

```text
Axios instance
fetch wrapper
interceptors
authentication headers
global error handling
```

Feature-specific API calls belong inside:

```text
features/<feature>/services/
```

Do not place every API call inside one global service file.

---

# 26. State Management

Keep state as close as possible to where it is consumed.

Prefer:

```text
local state
→ feature state
→ global state
```

in that order.

Do not introduce global state simply to avoid passing a small amount of data between nearby components.

Use global stores only when the state is genuinely application-wide.

Avoid unnecessary:

```text
Redux slices
Zustand stores
Context providers
```

for local feature concerns.

---

# 27. Context

Use React Context only for values that naturally belong to a component tree or global application context.

Examples:

```text
theme
authentication context
permissions
local feature context
```

Do not use Context as a replacement for every form of state management.

---

# 28. Separation of Responsibilities

Reusable UI components should not mix unrelated concerns.

Avoid combining:

```text
rendering
API calls
navigation
business rules
data transformation
complex validation
```

inside one shared component.

Prefer separation such as:

```text
UI Component
+
Hook
+
Service
+
Feature Container
```

---

# 29. Pages

Components under:

```text
src/pages/
```

should represent route-level views.

Pages should primarily compose:

```text
features
layouts
shared components
```

Do not place large reusable implementation logic directly inside route components when it belongs to a feature or common component.

---

# 30. Layout Components

Application shells belong in:

```text
src/components/layout/
```

Examples:

```text
Header
Sidebar
Navigation
PageContainer
MainLayout
```

Feature-specific layouts should remain within their feature when not globally reusable.

---

# 31. TypeScript

Use strong typing.

Avoid:

```typescript
any
```

unless there is a clear technical reason.

Prefer:

- explicit interfaces
- records
- discriminated unions
- generics when they improve reuse
- precise event types
- reusable shared types where semantics are genuinely shared

Avoid unnecessary type assertions.

Do not create duplicate interfaces representing the same concept.

---

# 32. Shared Types

Place truly shared types under:

```text
src/types/
```

Feature-specific domain types belong inside their feature.

Do not move types globally merely because more than one file inside the same feature uses them.

---

# 33. Accessibility

Reusable components must preserve accessibility.

Ensure appropriate:

- labels
- semantic HTML
- keyboard navigation
- focus states
- ARIA attributes when required
- disabled semantics
- error associations
- contrast

Do not break accessibility when wrapping MUI or other UI-library components.

---

# 34. Performance

Do not prematurely optimize.

However, avoid obvious frontend performance problems such as:

```text
unnecessary re-renders
large expensive computations during render
duplicate API requests
rendering extremely large lists without virtualization
unstable dependency loops
unnecessary global state updates
```

Use:

```text
useMemo
useCallback
React.memo
```

only when they solve a measurable or structurally clear problem.

Do not apply memoization everywhere by default.

---

# 35. Shared Component Changes Require Impact Analysis

Before modifying a shared component:

1. Find all its usages.
2. Understand existing behavior.
3. Check backward compatibility.
4. Verify whether current consumers rely on existing props or styling.
5. Update tests where appropriate.

Never modify a global reusable component based only on the needs of the current feature.

---

# 36. Avoid Unrelated Refactors

Do not perform large unrelated refactors while implementing a feature.

If unrelated architectural problems are discovered:

- document them
- suggest a separate follow-up
- leave them unchanged unless they block the requested task

However, do not knowingly introduce new duplication just to avoid touching an existing reusable abstraction.

---

# 37. Creating New Shared Components

A new global shared component should only be created when:

- multiple features can realistically reuse it
- the behavior is generic
- its API can remain domain-independent
- it meaningfully removes duplication
- no existing component already serves the same purpose

Do not move a component into `components/common` just because it might theoretically be reused someday.

---

# 38. Reusable Component Design

Shared components should expose the minimum API necessary.

Avoid dozens of boolean props.

Prefer composable APIs such as:

```tsx
<Card>
  <CardHeader />
  <CardContent />
  <CardActions />
</Card>
```

rather than:

```tsx
<Card
  showHeader
  showFooter
  showActions
  customMode
  specialHeader
  compactMode
/>
```

---

# 39. Barrel Exports

Use `index.ts` files where they improve import clarity.

Example:

```typescript
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

Avoid deeply nested imports when a clean public module API exists.

But do not create large barrel files that accidentally expose internal feature implementation details.

---

# 40. Dependency Discipline

Do not add a new frontend dependency when the same capability already exists in the project.

Before introducing a library, check:

- existing dependencies
- bundle impact
- maintenance status
- whether a native/browser solution exists
- whether MUI or existing utilities already provide the functionality

Avoid duplicate libraries solving the same problem.

---

# 41. Testing

Tests should be colocated with their components or modules where practical.

Examples:

```text
Button.test.tsx
useDebounce.test.ts
validation.test.ts
```

When modifying shared components, update or add tests for important behavior.

Focus tests on behavior rather than implementation details.

---

# 42. Error and Loading States

Reusable async UI should handle:

```text
loading
error
empty
success
disabled
```

states consistently.

Do not create unique loading indicators or error patterns for every feature when shared equivalents exist.

---

# 43. Before Implementing Any Task

Before coding, determine:

```text
What existing components can be reused?

What existing hooks or utilities already solve part of the task?

What project patterns should be followed?

Will this change introduce duplication?

Does anything need to be generalized?

Is the requested behavior feature-specific or globally reusable?
```

Search the repository before making architectural decisions.

---

# 44. Self-Review Before Completion

Before finishing any frontend task, review your implementation.

Verify:

```text
Did I create something that already existed?

Did I bypass an existing shared component?

Did I introduce duplicate logic?

Did I introduce duplicate styling?

Could an existing abstraction have been extended?

Did I over-generalize?

Does the implementation follow the directory architecture?

Are feature boundaries respected?

Are prop APIs consistent?

Did I preserve accessibility?

Did I check consumers before changing shared code?

Did I introduce an unnecessary dependency?

Did I perform unrelated refactoring?
```

Resolve issues before considering the task complete.

---

# 45. Required Completion Summary

When completing a frontend task, briefly state:

- which existing reusable components were reused
- which hooks or utilities were reused
- whether any shared components were modified
- whether any new reusable abstraction was introduced
- why any new abstraction was necessary
- whether raw MUI usage was intentionally retained
- any architectural/reuse opportunities found but intentionally left out of scope

---

# 46. Core Engineering Rule

Always follow this order:

```text
Search existing code
        ↓
Reuse existing abstraction
        ↓
Compose existing pieces
        ↓
Extend carefully
        ↓
Generalize when justified
        ↓
Create new code only when necessary
```

Treat the frontend as one shared system.

Do not treat each feature or task as an isolated implementation.

Before creating any frontend component, hook, utility, form field, or UI abstraction, search the repository for an existing equivalent.

Creating a duplicate implementation when a reusable implementation already exists is considered a defect.