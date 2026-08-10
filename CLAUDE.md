# Project instructions — Terminal Stories

A terminal-style interactive fiction system, built with SvelteKit + TypeScript + Tailwind.

## Language

- **Comments and JSDoc: in English.**
- **All user-facing text must be translatable.** Never hardcode a sentence shown to the user (in components, stores, services, or utilities). Define it as a Paraglide message in `locales/en.json` **and** `locales/fr.json`, then use it via `import * as m from "$lib/locales/messages"` (e.g. `m.my_key()`). Add the key to **both** locales and recompile (`npx @inlang/paraglide-js compile --project ./locales/.inlang --outdir ./src/lib/locales`).
- **Error and status messages follow the same rule.** Non-UI layers (services, utilities) must throw or return **machine-readable codes** (not localized strings); the UI maps those codes to Paraglide messages. Never throw, return, or store a hardcoded user-facing sentence.
- Commit messages are in English.

## Content typography (stories & wikis)

- **Never use the em dash `—` (or the en dash `–`) in story or wiki content.** This applies to all narrative text and to every `summary`/`description` field in stories (`src/lib/data/stories/`) and knowledge bases (`src/lib/data/knowledge/`). Use commas, parentheses, a colon, or separate sentences instead.
- **Only exception:** the ending-name markers in stories, e.g. `"— FIN : « Le prix du silence » —"`, which keep their em dashes.

## Comments and JSDoc

- Document **functions, and especially exported functions**, with a JSDoc block.
- Every JSDoc block that **I** (the assistant) write must end with `@author Claude`.
- Document parameters with `@param` and the return value with `@returns` when the function takes arguments or returns a value.
- Add logic comments (`// ...`) where behavior is not obvious (loop guards, side effects, non-trivial shortcuts). Do not paraphrase trivial code.

Example:

```ts
/**
 * Counts the words in a single string, ignoring surrounding whitespace.
 *
 * @param value - The text to measure.
 * @returns The number of whitespace-separated words.
 * @author Claude
 */
const countWords = ( value: string ): number =>
{
    const trimmed = value.trim();
    if ( trimmed === "" ) return 0;

    return trimmed.split( /\s+/ ).length;
};
```

## Prefer arrow functions

In JavaScript/TypeScript, **prefer arrow functions** over `function` declarations/expressions.

Prefer:

```ts
const getStory = ( id: string ): Story | undefined =>
{
    return stories.find( ( s ) => s.id === id );
};
```

Over:

```ts
function getStory( id: string ): Story | undefined
{
    return stories.find( ( s ) => s.id === id );
}
```

## Clarity over shortcuts

I favor **readability over terseness**. Extract long expressions or complex conditions into a named variable, then use it — rather than inlining everything.

Do:

```ts
const isStateOk = scene.isEnding || scene.choices.length === 0;

return isStateOk;
```

Rather than:

```ts
return scene.isEnding || scene.choices.length === 0;
```

This applies **to comparisons and conditions too**: name the intermediate value to make the intent explicit.

Do:

```ts
const hasReachedEnding = scene?.isEnding === true;

if ( hasReachedEnding )
{
    terminal.goBack();
}
```

Rather than:

```ts
if ( scene?.isEnding === true ) terminal.goBack();
```

## Code style

- Follow the existing formatting (Prettier + ESLint): inner spacing inside parentheses `( x )`, 4-space indentation.
- Before wrapping up, run both checks in order and fix any error before committing:
  1. `npm run check` — TypeScript + Svelte type checking
  2. `npm run lint` — ESLint rules
- Whenever a story or a wiki entry (files under `src/lib/data/`) is modified, run `npm run check-spell` at the end of the changes and fix any reported issue before committing.

## Planning before implementation

For any non-trivial request (new feature, refactor, multi-file change), draft a development plan first and have it reviewed before writing code:

1. Outline the steps, the files/areas impacted, and any open design decisions.
2. Share the plan with the user and wait for their review/approval.
3. Only start implementation once the plan is validated; adjust the plan (not just the code) if the approach changes mid-task.

Trivial changes (typo fixes, small isolated edits, one-line corrections) don't need this step.

## Preview / dev server

**Never start a preview or dev server.** Do not call `preview_start`, `npm run dev`, or any equivalent. The user runs the server manually. Verification is limited to `npm run check` and `npm run lint`.

**Exception for e2e verification:** after a change touching e2e-covered behavior, running the Playwright suite headless (e.g. `npm run test`, `npx playwright test`) is allowed as an automatic verification step. Never use `--ui`, `--headed`, `--debug`, or any mode that opens a browser window; headless only.

## Pre-commit quality checklist

Before considering any development finished, check for and fix all of the following (in addition to `npm run check` and `npm run lint`):

- **Useless or superfluous comments.** Remove comments that only restate what the code already says, commented-out code, and leftover TODO/debug comments that are no longer relevant. Keep only the logic comments described in [Comments and JSDoc](#comments-and-jsdoc).
- **Dead code.** Remove unused functions, variables, imports, exports, components, and files that are no longer referenced anywhere, as well as Paraglide message keys no longer used by any component (delete them from `locales/en.json` **and** `locales/fr.json`, then recompile).
- **Performance.** Watch for avoidable re-renders, unnecessary reactive recomputation, unbounded loops over large data, and repeated work that could be memoized or hoisted.
- **Accessibility.** Check semantic HTML (see [Semantic HTML](#semantic-html)), labels/`aria-*` attributes, keyboard navigability, and focus handling for anything touched.
- **Useless e2e tests.** Check for tests made redundant by the change (superseded assertions, duplicated coverage) per the conventions in [End-to-end tests](#end-to-end-tests-playwright).
- **No suppression comments.** Never add `svelte-ignore` or ESLint disable comments (`eslint-disable`, `eslint-disable-next-line`, etc.). Fix the underlying issue that triggers the warning instead of silencing it.
- **E2E run.** When the change touches behavior covered by a spec, run the Playwright suite headless (see [Preview / dev server](#preview--dev-server)) and fix any failure before committing.

## End-to-end tests (Playwright)

Tests live in `tests/e2e/` (config: `playwright.config.ts`) and exercise the whole app end to end (no preview/dev server should be started manually — Playwright's own `webServer` handles that). **Whenever a change touches user-facing behavior, update the matching spec(s) in the same commit**:

- `tests/e2e/menu.spec.ts` — main menu (catalog list, genre/language filters, search, keyboard navigation, direct-access shortcuts).
- `tests/e2e/story.spec.ts` — story playback (info screen, choices, endings, sharing, save/resume, restart, leaving to the menu).
- `tests/e2e/wiki.spec.ts` — encyclopedia (category/language/universe filters, search, entry detail, back navigation).
- `tests/e2e/achievements.spec.ts` — achievements (view from the menu, first-ending/all-endings unlocks, unlock notification, secret achievements masked, reset, AI stories excluded).
- `tests/e2e/ai-setup.spec.ts` — AI story generator (key validation, locked/unlocked form, generation success/error, ephemeral playback).
- `tests/e2e/editor.spec.ts` — custom stories (create/edit/play, fork a catalog story, import/export, validation and sanitizing, delete).
- `tests/e2e/deep-links.spec.ts` — shareable URLs (`?story=`, `?wiki=`) round-tripping through navigation and reloads.
- `tests/e2e/navigation.spec.ts` — cross-view keyboard access: opening the encyclopedia/achievements/AI generator/custom stories/a story from the main menu and returning to it with ESC.
- `tests/e2e/controls.spec.ts` — which footer the viewport gets (desktop keyboard legend vs mobile page navigation).
- `tests/e2e/sound.spec.ts` — sound toggle, volume slider, persistence, [M] shortcut.

Conventions to follow:

- Use `gotoMenu`/`gotoFresh`/`skipBoot` and the `open*`/`leaveToMenu` navigation helpers from `tests/e2e/utilities/fixtures.ts` to reach a clean starting point instead of duplicating boot/localStorage logic. The `open*` helpers already pick the right label per viewport.
- Assert on the English strings from `locales/en.json` (the app always renders the base locale in tests — the runtime's locale strategy doesn't read the browser's `Accept-Language`). Prefer accessible queries (`getByRole`, `getByLabel`, `getByText`) over CSS selectors.
- Never hardcode a story's scene graph/text as a path of choices — when a test needs to reach an ending, compute the path from the shipped JSON (see `tests/e2e/utilities/storyPath.ts`) so it keeps working as story content changes.
- Drive story playback with `choiceButton`/`skipTypewriter`/`playPath` from `tests/e2e/utilities/story.ts` rather than re-implementing them per spec.
- Mock external calls with `page.route()`; never hit real third-party endpoints from a test. The Anthropic stubs live in `tests/e2e/utilities/aiMocks.ts` and are shared by every spec that needs them.
- **Never force a viewport with `setViewportSize`.** The suite runs on two projects (`chromium` and `Mobile Chrome`), so every spec is already replayed at a phone-sized viewport; forcing a size makes the test run twice identically. When a behavior really is viewport-specific, use `test.skip( isMobile, ... )` / `test.skip( !isMobile, ... )`.
- Before adding a test, check it is not already implied by another spec (a `beforeEach` opening the same view, a strict superset of the same flow, the same shared utility exercised through another UI). When two tests need the same slow playthrough, merge them.
- When adding a new view, store action, or shortcut, add or extend a spec covering it — new functionality without e2e coverage should be treated as incomplete.

## Commits

- Conventional Commits (commitlint): `type(scope): description` in lowercase, no trailing period. e.g. `feat(story): add reading time estimation`.
- End the commit message with the model currently in use, e.g.:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Replace `Claude Sonnet 4.6` with the actual model name for this session (Opus, Sonnet, Haiku, etc.).

## Semantic HTML

Prefer semantic HTML elements over `<div>` and `<span>`. Use the element that best describes the content's role:

- `<main>`, `<header>`, `<footer>`, `<nav>`, `<aside>`, `<section>`, `<article>` for page regions
- `<ul>` / `<ol>` / `<li>` for lists of items (menu entries, wiki entries, choices...)
- `<button>` for interactive controls (already enforced), `<a>` for navigation links
- `<p>` for paragraphs of text, `<h1>`–`<h6>` for headings
- `<output>` for dynamically updated values, `<time>` for dates/durations

Reserve `<div>` and `<span>` for purely structural or styling wrappers that carry no semantic meaning of their own. When in doubt, ask: *does an element exist for this purpose?* If yes, use it.

## Component decomposition

Prefer splitting into smaller components rather than growing a single file. Extract a sub-component when:
- a section of a component has its own clear responsibility, or
- the file is getting long enough that navigation becomes awkward.

New components go in `src/lib/components/`.

## Architecture diagram

The `README.md` contains a Mermaid diagram (under the **Architecture** section) that summarizes how the project works — input flow, central store, views, data, services, and i18n. **Whenever the project's behavior or architecture changes** (new view, new service, altered data flow, removed component…), check that diagram and update it so it stays accurate.

## Structure

- `src/lib/components/` — Svelte components (Terminal, StoryMenu, WikiBrowser, etc.).
- `src/lib/stores/terminal.ts` — central store driving the whole UI (boot, menu, playback, wiki).
- `src/lib/data/` — stories and knowledge bases (JSON) + aggregations.
- `src/lib/utilities/` — utilities (e.g. reading-time computation).
- `src/lib/types/` — shared types.
