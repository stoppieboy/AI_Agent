---
name: smooth-ui
description: 'Design and implement smooth, polished UI with great UX. Use when building components, layouts, forms, modals, transitions, animations, loading states, or any user-facing interface. Covers accessibility, micro-interactions, responsive design, feedback patterns, and performance best practices. Trigger phrases: smooth UI, good UX, polished UI, animations, transitions, accessible, responsive layout, loading state, form UX, micro-interactions.'
argument-hint: 'Describe the component or screen to build (e.g. "a settings modal with form validation")'
---

# Smooth UI / Good UX

## When to Use
- Building or reviewing any user-facing component, screen, or layout
- Adding animations, transitions, or motion
- Designing loading, empty, and error states
- Implementing forms with validation feedback
- Ensuring accessible, keyboard-navigable interfaces
- Making a rough prototype feel polished and production-ready

---

## Core Principles

| Principle | Guideline |
|-----------|-----------|
| **Feedback** | Every action must have a visible response within 100ms |
| **Predictability** | UI behaves exactly as users expect — no surprises |
| **Forgiveness** | Allow undo, confirmation for destructive actions |
| **Accessibility** | WCAG AA minimum; keyboard nav and screen reader support always |
| **Performance** | Perceived performance > actual performance; use optimistic UI |
| **Consistency** | Reuse spacing, color, motion tokens across components |

---

## Procedure

### 1. Layout & Spacing
- Use an 8px base grid (spacing: 4, 8, 12, 16, 24, 32, 48, 64px)
- Prefer `gap` over margins for flex/grid children
- Align text to a consistent type scale (e.g. 12/14/16/20/24/32px)
- Ensure sufficient whitespace — crowded UI feels harder to use

### 2. Color & Typography
- Maintain a minimum contrast ratio of 4.5:1 for body text (WCAG AA)
- Use semantic color tokens (`--color-primary`, `--color-error`) not raw hex in components
- Limit font weights to 2–3 per UI (e.g. 400, 500, 700)
- Never rely on color alone to convey meaning — pair with icon or text

### 3. Motion & Transitions
- Default transition: `150–200ms ease-out` for interactive elements (buttons, hovers)
- Entrance animations: `200–300ms ease-out` (fade + slight upward translate)
- Exit animations: `150ms ease-in` (slightly faster than entrance feels natural)
- Avoid animating `width`/`height` directly — use `transform: scale()` or `max-height` tricks for performance
- Always respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition-duration: 0.01ms !important; }
  }
  ```

### 4. Loading States
- Show a skeleton/placeholder immediately (< 0ms delay) for content areas
- Use a spinner only for actions (button submit, file upload), not for page loads
- Disable — don't hide — interactive elements during async operations
- Optimistic UI: apply the change immediately, roll back on error

### 5. Form UX
- Validate **on blur** (not on keystroke) to avoid premature errors
- Show inline error messages directly below the offending field
- Use helper text (not placeholder) for format hints — placeholder disappears on focus
- Auto-focus the first field in modals/drawers on open
- Support `Enter` to submit single-field forms; `Tab` order must be logical

### 6. Empty & Error States
- Every list/table must have an empty state with a clear call to action
- Error messages must be human-readable, actionable, and not expose internals
- Use toast/snackbar for transient feedback (success, non-critical errors)
- Use inline banners for persistent or blocking errors

### 7. Micro-interactions
- Button press: slight `scale(0.97)` on `active` state
- Hover: subtle background change (`opacity` shift or tint), not just cursor change
- Focus ring: visible, high-contrast (`outline: 2px solid var(--color-focus)`)
- Destructive actions: require confirmation (dialog or inline "Are you sure?" toggle)

### 8. Accessibility Checklist
- [ ] All interactive elements reachable and operable by keyboard
- [ ] Focus ring never `outline: none` without a visible alternative
- [ ] Images have meaningful `alt` text (or `alt=""` if decorative)
- [ ] Form inputs have associated `<label>` (not just placeholder)
- [ ] Modals trap focus and restore it on close
- [ ] Color contrast passes at 4.5:1 for text, 3:1 for UI components
- [ ] Dynamic content updates announced via `aria-live` regions

### 9. Responsive Design
- Mobile-first: design for smallest viewport first, then expand
- Breakpoints: 480 / 768 / 1024 / 1280px (adjust to design system)
- Touch targets: minimum 44×44px (Apple HIG / WCAG 2.5.5)
- No horizontal scroll on any viewport width

### 10. Performance (Perceived)
- Lazy-load images and off-screen components
- Code-split routes; keep initial bundle < 200KB gzipped
- Avoid layout shift (CLS): reserve space for async content with fixed dimensions or aspect ratios
- Prefer `transform`/`opacity` for animations (GPU-composited, no layout reflow)

---

## Quick-Reference Snippet Library

### Smooth fade-in entrance
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.enter { animation: fadeUp 200ms ease-out both; }
```

### Button with press feedback
```css
.btn {
  transition: background 150ms ease-out, transform 100ms ease-out, box-shadow 150ms ease-out;
}
.btn:hover  { box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.btn:active { transform: scale(0.97); }
.btn:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

### Skeleton loader
```css
.skeleton {
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 4px;
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
```

---

## Completion Checklist
- [ ] Spacing follows the 8px grid
- [ ] All interactions have visible feedback ≤ 100ms
- [ ] Transitions use `ease-out` and stay under 300ms
- [ ] `prefers-reduced-motion` handled
- [ ] Loading, empty, and error states all present
- [ ] Forms validate on blur with inline errors
- [ ] Keyboard navigation works end-to-end
- [ ] Color contrast passes WCAG AA
- [ ] Touch targets ≥ 44×44px
- [ ] No layout shift for async content
