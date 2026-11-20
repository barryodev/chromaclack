# Clacker prototype

A standalone HTML/JS/CSS version of the clacker, used to settle its CSS transforms and animations by eye in a browser. Once it's settled, the work goes back into the SvelteKit frontend. Phase 1 settled the motion. It's now tracked in Linear under the milestone "Phase 2: Turn the prototype into an HSL colour toy".

## Rules

- Plain HTML, CSS and JavaScript only. No framework, no build step, no dependencies, no `package.json`.
- Work only inside this folder. The rest of the monorepo (Tauri, Rust, SvelteKit, pnpm, Turborepo) is out of scope.
- The files listed under Reference are read-only, and they're a dead end. Use them only to see what the clacker does on screen. Don't port their code, structure or abstractions. The prototype is built fresh, aiming at a multi-axis input element.
- Name the clacker's parts and interactions as defined in `../GLOSSARY.md`.

## Testing

Testing is split by the kind of code:

- **Pure logic gets unit tests.** A function with no DOM access and no global state, such as colour conversion, page ↔ value mapping, or choosing landings, lives in its own ES module. It gets tests in the same commit that adds or changes it. Tests use Node's built-in runner (`node --test`), so there are still no dependencies and no `package.json`.
- **Feel is checked by eye.** Easing, falls, bounces, seats and step sizes get no tests and no verification tooling. Passing tests are never evidence that the feel is right.

Existing physics in `clacker.js` moves into a module and gets tests only when an issue changes it.

## Viewing

Run `./serve.sh` from this folder. It serves on all interfaces and prints the localhost and Tailscale URLs, so a phone on the tailnet can open it. `python3 -m http.server` from this folder also works, at http://localhost:8000.

Opening `index.html` directly (`file://`) doesn't work, because browsers block ES modules loaded from `file://`.

## Reference

The current clacker in the Tauri/SvelteKit app. Read these for behaviour only:

- `../apps/frontend/src/lib/Clacker.svelte`
- `../apps/frontend/src/lib/Flap.svelte`
- `../apps/frontend/src/lib/flap-model.ts`
- `../apps/frontend/src/lib/gesture-model.ts`
- `../apps/frontend/src/app.css`
