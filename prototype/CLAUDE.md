# Clacker prototype

A standalone HTML/JS/CSS version of the clacker, used to settle its CSS transforms and animations by eye in a browser. Once it's settled, the work goes back into the SvelteKit frontend. Tracked in Linear under the milestone "Phase 1: Isolated prototype to lock in css transforms and animations", starting with DAI-38.

## Rules

- Plain HTML, CSS and JavaScript only. No framework, no build step, no dependencies, no `package.json`.
- Work only inside this folder. The rest of the monorepo (Tauri, Rust, SvelteKit, pnpm, Turborepo) is out of scope.
- The files listed under Reference are read-only, and they're a dead end. Use them only to see what the clacker does on screen. Don't port their code, structure or abstractions. The prototype is built fresh, aiming at a multi-axis input element.
- Name the clacker's parts and interactions as defined in `../GLOSSARY.md`.

## Viewing

Open `index.html` directly in a browser, or run `python3 -m http.server` from inside this folder and go to http://localhost:8000.

## Reference

The current clacker in the Tauri/SvelteKit app. Read these for behaviour only:

- `../apps/frontend/src/lib/Clacker.svelte`
- `../apps/frontend/src/lib/Flap.svelte`
- `../apps/frontend/src/lib/flap-model.ts`
- `../apps/frontend/src/lib/gesture-model.ts`
- `../apps/frontend/src/app.css`
