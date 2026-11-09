# Quality grid

What a 4 means on each of Nielsen's ten heuristics **for this product**, and what proves it. A heuristic only scores 4 when every criterion below holds everywhere; one counter-example caps it at 3. Each criterion names the e2e test (in `tests/e2e/`) or the check that proves it. Decisions that must not be scored against the product live in `.impeccable/critique/ignore.md`.

## Critique protocol

Every critique runs the same way, so two runs give the same score (expected gap: 0 to 1 point):

- Views: boot, menu, story info, playback, an ending, wiki list and entry, achievements, AI generator, My stories, editor, help dialog, share dialog.
- Sizes: 1280x800 and 375x812.
- Both locales (EN, FR) and the three phosphors (green, amber, cyan).
- Empty `localStorage` at the start.

## H1. Visibility of system status

| Criterion | Proof |
|---|---|
| An ending is recorded the moment it is reached; a reload never resumes on an ending. | `story.spec`: "an ending is recorded the moment it is reached" |
| Every automatic save is confirmed ("◉ SAVED", polite live region). | `story.spec`: "every automatic save is confirmed" |
| Endings found are shown by shape (● / ○) and text, not color alone. | `StoryListItem.svelte`, review |
| The AI key always shows its state (empty, unchecked, checking, valid, refused). | `ai-setup.spec`: "checks the key on request only" |
| Typewriter progress is visible (Skip button, cursor) and can be flushed. | `story.spec` |

## H2. Match with the real world

| Criterion | Proof |
|---|---|
| In-story strings (prompt, path recap, chosen states, story boot log) follow the story's language; the log carries its `lang`. | `story.spec`: "a story's own strings follow its language" |
| Every boot line is translated. | `BootSequence.svelte`, `npm run check` |
| Icons read as what they do (CRT screen for scanlines, speaker for sound). | review |

## H3. User control and freedom

| Criterion | Proof |
|---|---|
| `/` never pulls the reader out of a story. | `story.spec`: "the slash key does not leave a story" |
| ESC steps back one level everywhere, and asks before losing editor work. | `navigation.spec`, `editor.spec` |
| The editor has undo/redo over the whole draft (keys and buttons). | `editor.spec`: "guards the draft" |
| A generation in flight can be cancelled. | `ai-setup.spec`: "cancels a generation in flight" |
| Choices are final by design (see `ignore.md`); Restart and the path recap cover exploration. | decision |

## H4. Consistency and standards

| Criterion | Proof |
|---|---|
| Navigation order is the same on phones and desktop. | `TerminalControls.svelte`, `StoryMenu.svelte` |
| Links to encyclopedia entries are real `?wiki=` links everywhere (info screen, "See also"). | `wiki.spec`: "opens an entry detail" |
| Colors only come from role tokens; genres preview their universe's phosphor, wiki categories differ by icon. | review, design detector |
| One toggle model: fixed label plus `aria-pressed`. | `sound.spec` |
| Story text and encyclopedia text share one reading style (15px, Reading Green, 68ch). | review |

## H5. Error prevention

| Criterion | Proof |
|---|---|
| The AI key is validated on request only, its format before any network call. | `ai-setup.spec`: "checks the key on request only" |
| Scene ids are checked as typed (format, uniqueness). | `editor.spec`: "guards the draft" |
| Flag fields suggest the flags already used. | `EditorChoiceForm.svelte` |
| The editor draft is kept on the device and offered back after an unexpected close. | `editor.spec`: "guards the draft" |
| Destructive actions ask first (new game over a save, delete, leave the editor). | `story.spec`, `editor.spec` |

## H6. Recognition rather than recall

| Criterion | Proof |
|---|---|
| Footer legends hold five entries at most, none dead (no list keys without a list). | `controls.spec`, review |
| Filter shortcuts are shown where the filters are (GENRE [G], LANGUAGE [L]). | review |
| The info screen shows the reading time. | `StoryInfoDetails.svelte` |
| ✧ only appears once another ending has been found. | `terminal.ts` (`buildEndingPathLine`) |

## H7. Flexibility and efficiency of use

| Criterion | Proof |
|---|---|
| Every shortcut has a tappable counterpart and the reverse, and appears in the help and on its button. | `navigation.spec`, review |
| Shared links open their target directly. | `deep-links.spec`: "a shared link opens its target directly" |

## H8. Aesthetic and minimalist design

| Criterion | Proof |
|---|---|
| At least two stories are visible on a 600px-high screen (compact logo). | `TerminalLogo.svelte`, review |
| Reading chrome on phones is one bar of about 56px. | `StoryActionBar.svelte`, review |
| The French phone footer never overflows (two by two). | review at 375px in FR |
| No translucent text (`opacity-80`, `/80`). | grep, review |
| The editor has a clear type scale (18 / 16 / 14). | review |

## H9. Help users recognize, diagnose and recover from errors

| Criterion | Proof |
|---|---|
| A dead shared link is explained at the top of the menu. | `deep-links.spec`: "an unknown story id falls back" |
| Errors use the error role, at 4.5:1 or more on every phosphor. | `app.css`, design detector |
| Editor issues each open the scene to fix. | `editor.spec`: "guards the draft" |
| Import errors name the cause and the fix. | `editor.spec`: "rejects a file that is not valid JSON" |

## H10. Help and documentation

| Criterion | Proof |
|---|---|
| The help is searchable and task-oriented ("How to play", "Writing a story"). | `navigation.spec`: "[?] lists the current view's shortcuts" |
| Field help is tied with `aria-describedby` (AI key, scene id, flags). | review |
| A first-launch tip says how to get going, closable and remembered. | `menu.spec` |

## Accessibility (weighs on H1, H3, H4, H6)

| Criterion | Proof |
|---|---|
| Focus follows the task: first choice, Restart at an ending, entry title, new story title. | `story.spec`, `wiki.spec`, `editor.spec` |
| Catalog cards are named by their title only. | `StoryListItem.svelte` |
| A pick is announced once; the path recap is summarized for screen readers. | `TerminalOutput.svelte`, `EndingPath.svelte` |
| Text is 12px at least; touch targets are 44px on phones, 24px elsewhere. | review |
