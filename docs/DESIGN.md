---
name: Terminal Stories
description: Interactive stories printed by a phosphor terminal.
colors:
  phosphor-green: "#00ff46"
  amber-signal: "#ffb000"
  cyan-choice: "#00e5ff"
  pale-phosphor: "#e8ffe8"
  dim-phosphor: "#62a862"
  reading-green: "#9be8ab"
  tube-black: "#050e05"
  panel-green: "#001400"
  amber-phosphor: "#ffb000"
  amber-tube: "#0d0903"
  error-red: "#ff6b6b"
  cyan-phosphor: "#00e5ff"
  cyan-tube: "#020b10"
typography:
  title:
    fontFamily: "JetBrains Mono, Courier New, monospace"
    fontSize: "1.25rem"
    fontWeight: 700
    letterSpacing: "0.1em"
  body:
    fontFamily: "JetBrains Mono, Courier New, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "JetBrains Mono, Courier New, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.1em"
rounded:
  sm: "4px"
spacing:
  gutter: "16px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.phosphor-green}"
    textColor: "{colors.pale-phosphor}"
    rounded: "{rounded.sm}"
    height: "44px"
  button-secondary:
    textColor: "{colors.dim-phosphor}"
    rounded: "{rounded.sm}"
    height: "44px"
  legend-key:
    textColor: "{colors.dim-phosphor}"
    rounded: "{rounded.sm}"
    height: "32px"
---

# Design System: Terminal Stories

## Overview

**Creative North Star: "The Phosphor Monitor"**

Every screen is the face of a CRT monitor: light-emitting text on a near-black tube, a soft green halo around the frame, scanlines across the glass. The design lives in the screen itself, its phosphor color, its glow and its rhythm of printed lines, not in decoration placed on top of it. The monitor belongs to the fiction (a Raven Industries machine), so the console vocabulary is part of the story.

The surface is an Operate/Read hybrid: menus and editors must be scannable and predictable, while playback is a reading experience at a comfortable measure. Density stays low, chrome stays thin, and color is used as signal (amber warns or marks progress, cyan marks what can be chosen), never as ornament.

**Key Characteristics:**
- One monospace family for everything.
- Phosphor-on-black palette with semantic accents.
- Flat surfaces, 1px translucent borders, 4px radius.
- Glow only on floating layers (toasts, dialogs) and the monitor frame.
- Motion is printing: typewriter, short fades, a blinking cursor, all removed under reduced motion.

## Colors

A single phosphor family on a black tube, with two signal accents.

### Primary
- **Phosphor Green** (#00ff46): the monitor's own light. Focus rings, active filters, selected list item edge, the cursor, the logo, the boot log. Used as a line or a glow, rarely as a large fill (max 15% alpha fills).

### Secondary
- **Amber Signal** (#ffb000): saves and progress, ending text, warnings and destructive-action copy. Never names: speaker names and the story title in the status bar are Pale Phosphor (bold for speakers), so a name never reads as an alert on the amber theme, where the signal turns coral.

### Tertiary
- **Cyan Choice** (#00e5ff): live, pickable story choices and reading-time hints.

### Neutral
- **Pale Phosphor** (#e8ffe8): titles (including the story title in the status bar, set off from the view name by a dim `|` on every width), speaker names, selected text, the hover state of every control.
- **Reading Green** (#9be8ab): narration and long-form body text.
- **Dim Phosphor** (#62a862): system lines, labels, inactive controls and borders (at 20% to 60% alpha). Meets 4.5:1 on Tube Black at full opacity only; never lower its opacity for text.
- **Tube Black** (#050e05): the screen background. The page around the monitor is pure black.

### Error
- **Error Red** (#ff6b6b): failure messages only (refused key, broken link, import or save errors, invalid field), as `terminal-error`. Each phosphor redefines it at 4.5:1 or more.

### Phosphor themes
The monitor changes phosphor with the story on screen (info and playback views); every other view stays green. The theme is set by `data-phosphor` on `<main>`, which redefines the role tokens (`--color-terminal-green` is the *primary phosphor* role, whatever its hue, and so on for amber/signal, cyan/choice, white, text, dim, bg, panel, glow). Components only use the role tokens, never raw colors. A story's optional `phosphor` field wins; otherwise its genre decides.

| Theme | Used for | bg | primary | text | dim | signal | choice | error |
|---|---|---|---|---|---|---|---|---|
| green | menu, wiki, editor, drama, fantasy, horror, unknown genres | #050e05 | #00ff46 | #9be8ab | #62a862 | #ffb000 | #00e5ff | #ff6b6b |
| amber | detective, thriller | #0d0903 | #ffb000 | #f0c987 | #b48c4a | #ff7f50 | #5fd8ff | #ff5c7a |
| cyan | sci-fi | #020b10 | #00e5ff | #9fdcec | #5f9fb0 | #ffb000 | #6dffb3 | #ff6b6b |

Every text role reaches at least 4.5:1 on its theme's background and panel. The roles are registered with `@property`, so switching themes cross-fades over 0.6s (none under reduced motion).

The catalog previews each universe: a story's genre tag is a small outlined chip carrying `data-phosphor`, printed in that theme's primary (green, amber, cyan) on the list's dark tube, with no fill of its own, never a hue outside the roles. Encyclopedia categories are told apart by their icon alone. Toast, dialog and monitor shadows are `--shadow-toast`, `--shadow-dialog`, `--shadow-monitor`, recomputed per theme.

### Named Rules
**The Signal Rule.** Amber and cyan carry meaning (warning/progress, choosable). Never use them for decoration.

**The Full-Opacity Text Rule.** Text colors are used at full opacity. Translucent text (`opacity-80`, `/60`) falls under 4.5:1 and is banned.

## Typography

**Body Font:** JetBrains Mono (with Courier New, monospace), self-hosted in `static/assets/fonts/`.

**Character:** a single monospace voice, like a real terminal. Hierarchy comes from weight, case, letter-spacing and color, not from a second family.

### Hierarchy
- **Title** (700, 1.25rem, tracking 0.1em): story title on the info screen.
- **View title** (700, 1.125rem / 18px, tracking 0.1em): the `ViewTitle` h2 of every view; in the editor h3 sections are 16px and h4 sub-headings 14px, over a 14px body.
- **Body** (400, 0.9375rem / 15px, line-height 1.7): story text and encyclopedia entries, capped at 68ch, in Reading Green.
- **UI** (400, 0.875rem): list titles, dialogs.
- **Label** (400, 0.75rem / 12px, uppercase, tracking 0.1em): field labels, legend keys, status bar. 12px is the floor for any text.

## Layout

The app is one monitor: a full-height column capped at `max-w-4xl`, centered on black. Top to bottom: a skip link (visible on focus), the 44px status bar (title, view name, scanlines and sound toggles), the view's scrolling content, an optional action bar (story views), then the footer. The footer is a keyboard legend from `sm` up and a row of page-navigation buttons below `sm` (two by two on the menu, in the same order as the desktop navigation: Encyclopedia, My stories, AI, Achievements). While a story is read on a phone the footer folds into the action bar, which then holds the main action (Skip or Restart), "Main menu" and a "⋯" menu (Share, Help): about 56px of chrome. Side gutter 16px; safe-area insets are honored at the top and bottom.

The status bar confirms every automatic save with an amber "◉ SAVED" that lights up white and settles (a polite live region; the label is screen-reader-only on phones).

The ASCII logo appears on the main menu only, from `sm` up and above 1000px of height; every other screen gets the plain title (one line from `sm` up or under 700px of height, two lines on tall phones) so the first stories stay in view on a laptop. Every other view opens on a centered `ViewTitle` heading. A dead shared link's notice sits at the very top of the menu, in the error role. A first-launch tip (one unboxed line, closable, remembered) sits under the subtitle. The main menu shows its other destinations (Encyclopedia, My stories, AI, Achievements) as an in-page navigation row from `sm` up; phones get them in the footer.

## Elevation & Depth

Flat by default. Depth comes from the monitor itself: an outer green halo and an inner vignette (`box-shadow: 0 0 60px rgba(0,255,70,.08), inset 0 0 60px rgba(0,0,0,.8)`), plus a scanline overlay (`repeating-linear-gradient`, 20% black every 2px) removed under `prefers-contrast: more` or by the reader's own toggle in the status bar (persisted).

### Shadow Vocabulary
- **Toast glow** (`0 0 20px rgba(0,255,70,.25)`): floating notifications.
- **Dialog glow** (`0 0 40px rgba(0,255,70,.12)`): modal dialogs over a 70% black backdrop.

## Shapes

Rounded corners stay at 4px (`rounded`, and `--radius-terminal` for the custom scrollbars). Borders are 1px in Dim Phosphor at 30% to 60% alpha; active elements switch to a solid Phosphor Green border. Separators between scenes are a printed line of `─` characters.

## Components

- **Story action bar buttons:** 44px tall on mobile, 36px from `sm`. Primary: green border, 15% green fill, pale text. Secondary: dim border and text, pale on hover. From `sm` up each carries its key cap in a dim `<kbd>` (ENTER, SPACE, N, F, S) and declares it with `aria-keyshortcuts`.
- **Story boot log:** each playthrough opens with a short system log (archive of the story's universe being mounted, then two lines of its own world), closed by a separator.
- **Boot prompt:** the only control of the boot screen (short accessible name); a tap anywhere also starts. It pulses between 100% and 70% opacity so it never drops under 4.5:1.
- **Legend keys:** `[KEY] Label` pills, 32px tall, dim text, pale on hover. Desktop only. A key with no single target (`[1...n] Choose`) is a plain-text pill. The legend never repeats an action already on screen with its key cap (story info and playback list only what the action bar lacks). On desktop the playback action bar only appears with a main action (Skip while a scene types, Restart at an ending); while choices wait it folds away and `[S] Share` joins the legend, so reading never carries two bars for one rare action.
- **Choices:** numbered `[n]` lines in cyan inside an ordered list (the `[n]` key is visually hidden on coarse pointers). Once answered, each stays the same button, inert (`aria-disabled`, out of the tab order): the pick turns Pale Phosphor with a `▸` marker, the others are struck through in dim, and its accessible name gains "(chosen)" / "(not chosen)" (an attribute, so the log never announces the pick twice: the echoed line says it once). When a scene finishes typing, focus moves to its first choice; at an ending it moves to Restart. In-story strings use the story's language.
- **Story info facts:** a two-column definition list under the description (dim term, reading-green or cyan-link value): reading time (one playthrough, then the time to explore every branch, after a dim `·`), endings found (the ●/○ row, aria-hidden, then "n / N found"), main characters and universe, each character and the universe being an underlined cyan link to its encyclopedia entry (real `?wiki=` href).
- **Path taken:** printed under an ending, between two dim rules: an amber label heading ("PATH TAKEN · n choices"), then a two-digit numbered list of every branching point, the pick in Pale Phosphor with `▸`, the branches left behind struck through in dim, and `✧` on a discarded branch that still leads to an ending not found yet (with a one-line legend), shown only once another ending was already found. Screen readers get the count of such branches, then only the pick and those branches per step.
- **Catalog endings:** one `●` per ending found and `○` per ending left, with "n / N found" in text: the shape carries the state, not the color. Catalog cards are named by their title (`aria-labelledby`); the meta line, universe and description are their description.
- **Toggles (scanlines, sound):** one model: a fixed label ("Scanlines", "Sound") and `aria-pressed`. The scanlines icon is a small CRT screen with two lines across it (struck through when off).
- **Toasts:** top-centered stack, opaque panel fill (the theme's `panel` role), border at 60% alpha (green, or amber for a tragic ending, dim for a neutral one), toast glow, slide-in 250ms, 44×44px close button. Achievement icons are CSS masks over the theme's primary, so they match every phosphor. They appear only once the ending has finished typing: the ending toast first, the achievement toast 1.5s later. Their copy follows the ending's tone, never a celebration after a tragic ending.
- **Dialogs:** native `<dialog>`, focus on the safe action, destructive action in amber. The share dialog's QR sits on a white card on every phosphor; text on that card uses the fixed `qr-ink` (#1a140c) and `qr-error` (#a11d1d) colors, never a role. The help dialog (`?`, the `[?] Help` legend entry, the `?` square on phones, or the reading "⋯" menu) opens on a filter field (focused; case and accents ignored), then "How to play" (or "Writing a story" in the editor and My stories), the current screen's shortcuts and the global ones, as `[KEY] Description` lines; closing it returns focus to where it was.
- **Resume recap:** when a save is resumed, the last scene played and the choice taken print instantly in Dim Phosphor under a "Last scene played:" system line, then the current scene types as usual.
- **Inputs:** transparent fill, green text and caret, container border turns solid green on focus. Short help lines in dim 12px sit under tricky fields, tied with `aria-describedby`.
- **Editor:** one border per level. Top-level sections (STORY, CHARACTERS, then scenes) are fieldsets with a top rule and an h3 legend sitting on it; the scene form has h4 sub-headings (TEXT, CHOICES); only the scene navigator and each choice card keep a box. Checkboxes are 24px. Ctrl/Cmd+S saves, Ctrl+Z / Ctrl+Y undo and redo the whole draft (also as buttons next to Save); ESC in a field parks focus on the editor itself. Scene ids are checked as typed (inline error, `aria-invalid`), flag fields suggest the flags already used (`<datalist>`), each issue tied to a scene is a link-styled button opening it, and an unsaved draft kept on the device is offered back (Restore / Discard) after an unexpected close.

## Do's and Don'ts

- Do keep text at full opacity and at least 12px.
- Do give every tappable control 44px on mobile.
- Do name a color by its role (`terminal-dim`), never a raw hex in a component; a new theme only redefines roles in `app.css`.
- Don't add a second typeface.
- Don't use amber or cyan for decoration.
- Don't remove the focus outline (`outline-none`) without a visible replacement.
- Don't keep more than five entries in a footer legend; the rest belongs on the page or in the help overlay.
- Don't animate anything that ignores `prefers-reduced-motion`.
