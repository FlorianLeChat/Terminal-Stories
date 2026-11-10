# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Curious readers of interactive fiction, in French or English, who sit down for a short story (10 to 30 minutes per playthrough) and want to make choices that matter. They read on a desktop with a keyboard or on a phone by touch, often in one sitting, sometimes coming back later to resume a save or hunt the endings they missed.

Secondary audiences, confirmed by existing features but not the primary target: amateur authors who write or fork stories in the built-in editor, and players who bring their own Anthropic API key to generate a one-shot story.

## Product Purpose

Terminal Stories is an interactive story reader styled as a retro computer terminal. It lets people read, explore and play branching stories, save and resume them, discover every ending, and learn more about each story's world in an encyclopedia. Success means a reader finishes a story, wants to see another ending, and understands the world well enough to care about it.

## Positioning

- **The terminal is part of the fiction.** The interface is a Raven Industries machine booting up, logging and printing, not a skin over a generic reader. Boot lines, the typewriter, the phosphor glow and the console vocabulary belong to the world.
- **Every story has an encyclopedia.** Each catalog story is backed by a knowledge base (universe, characters, places, endings) that readers can browse. The encyclopedia is assumed context, not a spoiler shield: endings stay listed there on purpose.
- **Bring-your-own-key AI stories.** Generated stories use the player's own Anthropic key, called straight from the browser; nothing is stored on a server and generated stories are never saved.
- **Sober and private.** A static site, no cookies, no ads, no tracking by default (optional Umami analytics only), fully usable by keyboard and screen reader.

## Operating Context

- Main loop: boot, main menu (full catalog on first launch, genre and language filters, search), story info screen (description, reading time for one playthrough and for every branch, endings found as ●/○, main characters and universe linked to the encyclopedia), playback with numbered choices, ending with a recap of the path taken (choices made, branches left behind, branches still leading to unfound endings), back to the menu or restart.
- Save completion is the share of distinct scenes visited over the story's total scenes.
- Side views: encyclopedia (category, language and universe filters, search, entry detail), achievements, AI story generator, "My stories" (custom stories list) and the story editor.
- Deep links `?story=` and `?wiki=` make stories and wiki entries shareable; a share dialog adds a QR code. A shared link skips the system boot and opens its target directly (a story still prints its own boot log). A link to an unknown id lands on the menu with a notice explaining why, at the top of the view.
- The AI generator offers the catalog genres and languages as lists (language defaults to the reader's locale); the model list appears once the key is validated.
- Progress is saved in `localStorage` on the device only, after every choice, and each save is confirmed by a "◉ SAVED" mark in the status bar (announced politely). An ending is recorded the moment it is reached and closes the save, so a reload never resumes on an ending. Discovered endings and achievements persist the same way.
- Choices are final: there is no undo during playback. Readers replay a story to explore other branches; the path recap shows (with ✧, once an ending has already been found) which branches still hide an ending.
- The strings printed inside a story (choice prompt, path recap, chosen/not chosen states, story boot log) follow the story's language, not the interface's, and the story log carries that `lang`.
- The editor keeps an undo/redo history of the draft (Ctrl+Z / Ctrl+Y, with buttons), checks scene ids as they are typed, suggests the flags already used, keeps the unsaved draft on the device and offers it back after an unexpected close, and its issues each open the scene to fix.
- The AI key is checked on request only (button or ENTER, never on blur), its format first so a typo never reaches the network; a status line always says where the key stands. A generation in flight can be cancelled.
- Keyboard is the primary input on desktop (a short shortcut legend of five entries at most sits in the footer, the full help is one `?` away), touch on mobile (page-navigation footer and on-page buttons; while reading, a single action bar carries the main action, the way back and a "more" menu). The help is searchable, opens on "How to play" (or "Writing a story" in the editor), then lists the screen's shortcuts and the global ones. A first-launch tip on the menu says how to get going, until closed.
- Resuming a save recaps the last scene played before continuing.

## Capabilities and Constraints

- SvelteKit + TypeScript + Tailwind, built once and served statically (GitLab Pages, GitHub mirror).
- Every user-facing string is a Paraglide message in `locales/en.json` and `locales/fr.json`; non-UI layers return machine-readable codes.
- Stories are JSON files (`src/lib/data/stories/`) with flags (`requiresFlag` / `setsFlag`), per-scene music and sound effects, and typed endings (`good`, `bad`, `neutral`).
- Story and wiki content never uses the em or en dash, except in ending-name markers.
- Decided and kept: the typewriter effect has no speed setting, and the "Speedrunner" achievement stays.
- Custom stories and AI stories never award achievements and are never shareable by URL.

## Brand Commitments

- Name: Terminal Stories. The in-world operating system is "Raven Green" by Raven Industries; the boot sequence keeps it.
- Voice: a terse system console around the stories, and the story's own narrative voice inside them. French stories address the reader with "tu", and so does the in-story choice prompt ("Que fais-tu ?"); the rest of the French UI uses "vous".
- Vocabulary: "Encyclopedia" (never "knowledge base"), "Main menu" for the way back to the catalog, "Restart" ("Rejouer") after an ending. Music themes and sound effects are shown by translated name, stored by identifier.
- Monospace typography (JetBrains Mono) and a phosphor terminal look are binding. Each universe has its own phosphor (amber for investigations, cyan for space, green for the system itself and every other genre), set per story with an optional `phosphor` field and otherwise derived from the genre; the editor lets authors pick it.
- The monitor comes in a dark scheme (phosphor on a black tube) and a light one ("Amber Paper": the same phosphors as dark inks on warm amber paper). By default it follows the browser's preference; readers can force light or dark from the status bar or with `[T]`, and the choice is kept on the device.

## Evidence on Hand

- Six catalog stories: `cursed-forest`, `l-affaire-du-raton-laveur`, `la-femme-aux-cheveux-en-or`, `last-call`, `le-dernier-espoir`, `terminus-station`, three in English and three in French, each with a knowledge base in `src/lib/data/knowledge/`.
- Achievement icons in `static/assets/`.
- No testimonials, user counts or press exist; never invent them.

## Product Principles

1. **The story comes first.** Interface chrome stays quiet while a scene is read; console flourishes serve immersion, never compete with the text.
2. **Choices leave a trace.** What the reader picked and what they left behind stays visible and is announced to assistive tech.
3. **Keyboard and touch are equals.** Every shortcut has a visible, tappable counterpart, and the reverse.
4. **One word per thing.** A view, an action or a key keeps the same name and meaning everywhere.
5. **Private by default.** Nothing leaves the device unless the reader explicitly calls the AI with their own key.

## Accessibility & Inclusion

- Target WCAG 2.2 AA: text contrast at least 4.5:1 on every theme, touch targets at least 44 px on mobile (24 px minimum elsewhere), visible focus everywhere.
- The story log is a `role="log"` live region; the line being typed is hidden from assistive tech.
- `prefers-reduced-motion` disables the typewriter, fades and blinking; `prefers-contrast: more` removes the scanlines, and readers can switch them off themselves.
- Focus follows the task: a new scene's first choice, "Restart" at an ending, an encyclopedia entry's title when it opens, the title field of a story just created. Catalog cards are named by their title alone. State never rests on color alone (endings found are ● / ○).
- `docs/QUALITY.md` lists, per heuristic, the product-specific criteria of a top score and the test that proves each one.
- A "Skip to content" link leads past the status bar; on touch screens no menu card is expanded until the first tap.
