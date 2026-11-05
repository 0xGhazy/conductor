---
name: Weaver
description: Workflow orchestration console on Netflix Conductor; a dense, restrained admin UI where the record does the talking.
colors:
  accent-solid: "#D9102B"
  accent-hover: "#BD0D25"
  accent-subtle: "color-mix(in srgb, #D9102B 12%, transparent)"
  canvas-subtle: "#F3F5F9"
  canvas-default: "#FFFFFF"
  surface-soft: "#E9EDF4"
  surface-sunken: "#E1E6EF"
  fg-default: "#151B2B"
  fg-muted: "#4A5468"
  fg-soft: "#5B667C"
  border-default: "#D8DDE8"
  border-strong: "#7E899E"
  status-success: "#15803D"
  status-danger: "#C81E2D"
  status-warn: "#9A5A00"
  status-info: "#1D4ED8"
typography:
  title:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  subtitle:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
  section-title:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 650
  body:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  column-header:
    fontFamily: "Open Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.04em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  panel-inset: "22px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.canvas-default}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outlined:
    backgroundColor: "{colors.canvas-default}"
    textColor: "{colors.accent-solid}"
    rounded: "{rounded.md}"
  button-outlined-hover:
    backgroundColor: "{colors.accent-subtle}"
    textColor: "{colors.accent-hover}"
  input-field:
    backgroundColor: "{colors.canvas-default}"
    textColor: "{colors.fg-default}"
    rounded: "{rounded.md}"
    height: "40px"
  filter-chip:
    backgroundColor: "{colors.canvas-default}"
    textColor: "{colors.fg-default}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "0 4px 0 10px"
    height: "30px"
  hidden-value-chip:
    textColor: "{colors.fg-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  code-block:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.fg-default}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  code-block-before:
    backgroundColor: "{colors.canvas-subtle}"
    textColor: "{colors.fg-muted}"
  error-box:
    textColor: "{colors.fg-default}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  detail-panel:
    backgroundColor: "{colors.canvas-default}"
    textColor: "{colors.fg-default}"
    width: "min(540px, 100vw)"
  container-card:
    backgroundColor: "{colors.canvas-default}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
---

# Design System: Weaver

## Overview

**Creative North Star: "The Quiet Ledger"**

Weaver is an operator's console. Its surfaces read like a well-kept ledger: white or near-white sheets on a cool grey desk, divided by single hairline rules, with ink in three strengths (default, muted, soft). Nothing is framed that a rule can separate, and nothing is coloured that does not need to be acted on or judged. The one loud colour, Weaver red, belongs to the things you can do and the thing you are looking at; green and red status inks belong to outcomes. Everything else is greyscale and type weight.

Density is deliberate. Body copy runs at 13px, metadata at 12.5px, captions and identifiers at 12px, and hierarchy comes from weight (400 / 500 / 600 / 650) and ink strength rather than size jumps. Monospace is reserved for what a machine wrote: code, ids, actions, IP addresses and recorded values. The system ships light and dark themes from the same token names (`html[data-theme]`); every rule below holds in both.

The audit event panel is the clearest expression of the world: a right-side sheet that opens on a plain sentence ("Updated query"), puts the field-by-field change first, and keeps the who/when/outcome on one quiet meta line.

**Key Characteristics:**
- Cool grey desk (canvas-subtle) under white sheets (canvas-default), separated by 1px border-default rules.
- One accent, Weaver red, for actions and current focus only.
- Status colour only on outcomes and errors.
- Hierarchy by weight and ink strength at small, dense sizes.
- Monospace only for machine-written text.
- Flat surfaces; depth by tone and hairlines, with soft shadows held for floating layers.

## Colors

A cool, slightly blue-grey neutral ramp carries almost the whole interface; one saturated red and four status inks do the signalling. Values below are the light theme (`ui/src/styles/variables.css`); the dark theme redefines the same names.

### Primary
- **Weaver Red** (accent-solid): filled primary buttons (Apply, an active Filters toggle), the selected tab indicator, the active nav item. In the light theme it is also the accent text colour (`--color-accent-fg`), used for outlined buttons, link-style actions (the Action column links that open an event) and focus rings.
- **Pressed Red** (accent-hover): hover state of filled and outlined accent buttons.
- **Red Wash** (accent-subtle): 12% red tint behind outlined-button hover, the active nav row, primary MUI chips and avatar initials.

### Neutral
- **Desk Grey** (canvas-subtle): the app background behind pages; also the "Before" block in a long change, so the old value literally sits on the desk while the new one sits on the sheet's grey.
- **Sheet White** (canvas-default): panels, cards, the detail drawer, filter chips, fields.
- **Soft Slate** (surface-soft): code and prose blocks, table header and row hover, small inline value tags, skeleton bars, icon-button hover.
- **Sunken Slate** (surface-sunken): recessed wells.
- **Ink** (fg-default): primary text, section titles, "After" values.
- **Muted Ink** (fg-muted): labels, metadata, captions, "Before" values, filter-chip labels.
- **Soft Ink** (fg-soft): separator dots, arrows, "Empty" placeholders, neutral status dots.
- **Hairline** (border-default): every divider rule, panel edge, card and chip border.
- **Field Edge** (border-strong): outlined input borders at rest.

### Status
- **Success Green** (status-success): the success status dot; granted permissions.
- **Danger Red** (status-danger): the failed status dot, the error box (45% mixed into its border, 7% into its fill), validation messages.
- **Warn Amber** (status-warn) and **Info Blue** (status-info): warnings and queued/info states.

A categorical hue palette (`--hue-indigo` through `--hue-fuchsia`, each with `-ink` and `-tint`) exists for the workflow designer's task-node types; it is not used on admin surfaces like Settings.

### Named Rules
**The One Voice Rule.** Weaver red marks what you can do or what you are looking at (a button, a link-action, the open row, the focused field). It never decorates a heading, a section or a container.

**The Outcome Ink Rule.** Green and red status inks appear only on outcomes and errors, as a 7px dot beside a plain word ("Success", "Failed") or inside the error box. Status is never conveyed by colour alone.

## Typography

**UI Font:** Open Sans (with sans-serif), loaded from Google Fonts as a variable face (300..800) and forced on `html, body, button, input` in `globals.css`.
**Mono Font:** ui-monospace, SFMono-Regular, Menlo, Consolas, monospace, with tabular numerals.

**Character:** A humanist sans set small and dense, with weight doing the ranking; monospace is the only second voice and it always means "the machine wrote this".

### Hierarchy
- **Title** (650, 17px, 1.3, -0.01em, balanced wrap): the detail panel's sentence title ("Updated query").
- **Subtitle** (500, 13.5px, fg-muted): the subject under a title (the resource name).
- **Section Title** (650, 13px, fg-default): panel section headings (Changes, Context, Error, Recorded arguments).
- **Body** (400, 13px, 1.5): rows, values, descriptions, error text.
- **Body Small** (400, 12.5px): meta lines, notes, filter chips, card descriptions.
- **Caption** (400, 12px, fg-muted): Before / After captions, secondary lines such as an email under a name.
- **Mono** (400, 12px, 1.55, tabular): code blocks, ids, action names, IPs.
- **Column Header** (700, 11px, 0.04em, uppercase, fg-muted): table column heads only.

### Named Rules
**The Weight Ladder Rule.** Rank by weight before size: 650 for titles and section headings, 600 for emphasised values ("After", chip values, names), 500 for a field name that heads its own block, 400 for everything else. A field name must never match the weight of the section title above it.

**The Machine Voice Rule.** Monospace only for code, identifiers, action names and recorded values; never for labels, headings or prose (a description shows in the UI face even inside a code-style frame).

## Layout

Pages sit on the desk grey inside the app shell (global header, main sidebar, Settings sub-navigation). Content stacks vertically with 12px gaps: filter bar, filter actions row, optional advanced-filter card, then the data table.

- **Filter toolbar:** a wrapping row of 40px fields (`--weaver-field-height`) with 12px gaps, fixed field widths (170-240px); a second row at 8px gaps holds the Filters toggle, active filter chips and a text "Reset filters". The advanced filters form is a card holding an auto-fill grid (minmax 200px) at 12px gaps.
- **Detail panel:** right-anchored, `min(540px, 100vw)` wide. Header inset 18px 16px 14px 22px; body inset 20px 22px 32px; sections 24px apart; section title 10px above content.
- **Label / value rows:** a two-column grid (label `minmax(110px, 34%)`, value `1fr`, 12px gap), 10px vertical padding, divided by hairlines. Long values break into a single column of stacked Before / After blocks (8px gap, 260px max height, scrolling).
- **Rhythm:** 4 / 8 / 12 / 16 / 24px, with 22px as the panel's side inset.
- **Responsive (600px):** the panel's insets tighten to 16px and every label/value row stacks to one column; the Action filter goes full width.

**Known app-shell limitation (not a rule):** at 390px the global header and main sidebar make every page wider than the viewport (788px with the sidebar open, 592px collapsed). Page and panel layouts are correct within that; the shell itself is out of scope here and should not be copied or compensated for page by page.

## Elevation & Depth

Flat by default. Depth comes from tone (desk grey under white sheets, soft slate inside sheets) and from 1px hairlines; cards, chips and the error box carry no shadow. Shadows are held for things that float above the page: MUI's own drawer, menu and popover elevation, and the `--shadow-sm` / `--shadow-md` tokens for raised surfaces. The detail drawer pairs MUI's drawer shadow with a 1px hairline on its left edge. Filled buttons explicitly drop elevation (`boxShadow: none`, `disableElevation`).

### Shadow Vocabulary
- **Raised low** (`box-shadow: 0 1px 3px rgba(21, 27, 43, .08)`): slightly lifted surfaces.
- **Raised medium** (`box-shadow: 0 1px 3px rgba(21, 27, 43, .08), 0 4px 12px rgba(21, 27, 43, .06)`): floating cards and overlays.
- **Focus ring** (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent-fg) 35%, transparent)`): every custom focus-visible state and focused inputs.

### Named Rules
**The Hairline Rule.** Separate with a single 1px border-default rule before reaching for a frame; separate with a frame before reaching for a shadow.

## Shapes

Gently rounded and consistent. Buttons, inputs, cards and the error box use 8px; code and prose blocks and MUI chips 6px; small inline tags, skeleton bars and link highlights 4px. Removable filter chips and the hidden-value chip are full pills (999px); status and separator dots are circles. MUI's base `shape.borderRadius` is 10px, but every component the Settings pages use overrides it to 8px or less.

## Components

### Buttons
Quiet, confident, sentence case.
- **Shape:** gently rounded (8px), weight 600, no text transform; colour transitions at 0.2s ease.
- **Primary (contained):** Weaver red fill, white text, no shadow; hover deepens to Pressed Red. Used for the committing action (Apply) and for a toggle that is on (Filters with a count, or with its panel open).
- **Outlined:** red text and border on white; hover adds the Red Wash. Used for secondary actions and pivots ("Show all by this actor", "Refresh", "Try again"), with a 14px leading line icon where it helps.
- **Text:** red text, no frame, for dismissive or resetting actions ("Reset filters", "Clear these", "Cancel").
- **Icon buttons:** small MUI icon buttons with 18px line icons for Previous / Next / Close; disabled at the page edge with a tooltip saying why.

### Chips
- **Removable filter chip:** white pill, hairline border, 30px tall; muted label then a 600-weight value (ellipsis at 220px), then a 22px circular remove button that gains Soft Slate on hover and the focus ring on focus.
- **Hidden-value chip:** hairline pill with a 12px lock icon and muted 12px text ("Changed (hidden)"); the only way a secret appears.
- **Status:** not a chip; a 7px dot (green, red or soft ink) followed by the word.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** Sheet White on the desk.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px hairline.
- **Internal Padding:** 14px 16px.

### Inputs / Fields
- **Style:** MUI outlined fields at 40px, 8px radius, Field Edge border at rest, Muted Ink on hover.
- **Focus:** border turns accent (1.5px) and gains the focus ring.
- **Error:** danger-ink message below; advanced filters validate on submit, not per keystroke.

### Navigation
- **Sidebar and Settings sub-nav:** line icon plus label at body size; the active item gets the Red Wash background with red text (and a red edge bar in the main sidebar).
- **Tabs:** 600 weight, muted at rest, red when selected, with a 3px red indicator rounded on top.

### Detail Panel (signature)
The audit event panel is the reference for any record-detail drawer.
- **Header:** sentence title plus muted subject; a single meta line (status, actor, relative time with exact time in a tooltip, duration) whose 3px dots end each item so a wrapped line never starts with a separator.
- **Order:** error box (failed only), then the changes, then Context (label/value grid), then pivot buttons, then collapsed raw data last behind a disclosure whose chevron rotates 90deg in 120ms.
- **Change row:** muted label; short values show "Before" struck through in Muted Ink, a soft arrow, and "After" in 600 Ink. Long values show stacked Before / After blocks, Before on Desk Grey in Muted Ink, After on Soft Slate.
- **States:** skeleton bars with a 1.4s shimmer while loading (static under reduced motion), a plain sentence plus "Try again" on error, a plain note when nothing was recorded.
- **Keyboard:** Up / Down step to the neighbouring event when focus is outside the scrolling body.

## Do's and Don'ts

### Do:
- **Do** use the token names (`var(--color-*)`) rather than literal hex, so both themes hold.
- **Do** separate rows with a single 1px border-default rule and let the values carry the weight.
- **Do** rank text with the weight ladder (650 / 600 / 500 / 400) at 13px and below before adding size.
- **Do** pair every status colour with a word: a 7px dot plus "Success" or "Failed".
- **Do** show secrets only as a hidden-value chip ("Changed (hidden)"); name JDBC property keys, never their values.
- **Do** give every custom interactive element the shared focus ring and honour `prefers-reduced-motion`.
- **Do** collapse label/value grids to one column below 600px.

### Don't:
- **Don't** use Weaver red on headings, section titles, borders of passive containers or decoration.
- **Don't** use green or red status inks for anything but outcomes and errors.
- **Don't** set labels, headings or prose in monospace.
- **Don't** add shadows to cards, chips or inline boxes; flat surfaces with hairlines are the default.
- **Don't** let a field name match the 650 weight of its section title.
