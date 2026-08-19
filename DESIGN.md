# MegaChat Design Contract

## Direction

MegaChat should feel like a focused operator console: dark, direct, technical without being intimidating, and visibly connected to the existing black-and-signal-orange brand. Setup should read like a guided launch checklist, not a cloud control panel.

## Layout

- Keep primary content within a `72rem` editorial frame.
- Use a narrow progress rail beside one continuous work surface on desktop; collapse it above the form on mobile.
- Separate setup stages with rules, whitespace, and numbering instead of a grid of equal cards.
- Keep the next action visible near the active fields and preserve a clear path back to MegaChat.

## Typography

- Archivo is the primary and display face; Space Mono is reserved for step labels, environment-variable names, and technical values.
- Headlines are compact, high-contrast, and sentence case or short uppercase phrases.
- Supporting copy stays conversational and avoids infrastructure jargon unless a provider uses that exact term.

## Shape and surfaces

- Use flat dark surfaces with thin borders and restrained corner radii.
- Inputs and real action areas may be boxed; explanatory copy should not be wrapped in decorative cards.
- Avoid nested cards, heavy shadows, glass effects, decorative gradients, and floating blobs.

## Motion

- Limit motion to short color, border, opacity, and transform feedback on controls.
- Do not animate page entry or progress automatically.
- Disable non-essential transitions when `prefers-reduced-motion: reduce` is active.

## Color tokens

- All setup UI colors come from semantic `--setup-*` CSS variables in `app/globals.css`.
- Signal orange is reserved for the active step and primary action.
- Green communicates completed or verified work; red is only for actionable errors.
- Never place secret values in low-contrast text or expose them outside intentional form/output controls.

## Anti-patterns

- No feature-card grids, bento layouts, nested cards, gradients, decorative illustrations, or oversized marketing copy.
- No permanent debug controls or provider implementation details.
- No secret values in URLs, logs, query strings, or browser storage.
- No setup step that suggests the browser can mutate Vercel configuration automatically.

## Visual QA checklist

- Desktop: progress rail and form align; the first required field is visible without ambiguity.
- Mobile: links, inputs, copy buttons, and the primary action fit at 320px without horizontal scrolling.
- Keyboard: every field and button has a visible focus state and a programmatic label.
- Secrets: password fields are masked by default and external links open separately without losing form state.
- Completion: migration success and the remaining Vercel redeploy step are visually distinct.
- Reduced motion: transitions are effectively removed.
