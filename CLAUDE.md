# Project instructions — Terminal Stories

A terminal-style interactive fiction system, built with SvelteKit + TypeScript + Tailwind.

## Language

- **Comments and JSDoc: in English.**
- **User-facing strings (UI): in French.** Never translate the interface to English.
- Commit messages are in English.

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

## Preview / dev server

**Never start a preview or dev server.** Do not call `preview_start`, `npm run dev`, or any equivalent. The user runs the server manually. Verification is limited to `npm run check` and `npm run lint`.

## Commits

- Conventional Commits (commitlint): `type(scope): description` in lowercase, no trailing period. e.g. `feat(story): add reading time estimation`.
- End the commit message with the model currently in use, e.g.:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Replace `Claude Sonnet 4.6` with the actual model name for this session (Opus, Sonnet, Haiku, etc.).

## Component decomposition

Prefer splitting into smaller components rather than growing a single file. Extract a sub-component when:
- a section of a component has its own clear responsibility, or
- the file is getting long enough that navigation becomes awkward.

New components go in `src/lib/components/`.

## Structure

- `src/lib/components/` — Svelte components (Terminal, StoryMenu, WikiBrowser, etc.).
- `src/lib/stores/terminal.ts` — central store driving the whole UI (boot, menu, playback, wiki).
- `src/lib/data/` — stories and knowledge bases (JSON) + aggregations.
- `src/lib/utilities/` — utilities (e.g. reading-time computation).
- `src/lib/types/` — shared types.
