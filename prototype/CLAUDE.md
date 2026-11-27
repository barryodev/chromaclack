# Clacker prototype

A standalone HTML/JS/CSS version of the clacker, used to settle its CSS transforms and animations by eye in a browser. Once it's settled, the work goes back into the SvelteKit frontend. Phase 1 settled the motion. It's now tracked in Linear under the milestone "Phase 2: Turn the prototype into an HSL colour toy".

## Rules

- Plain HTML, CSS and JavaScript only. No framework, no build step, no dependencies, no `package.json`.
- Work only inside this folder. The rest of the monorepo (Tauri, Rust, SvelteKit, pnpm, Turborepo) is out of scope.
- The files listed under Reference are read-only, and they're a dead end. Use them only to see what the clacker does on screen. Don't port their code, structure or abstractions. The prototype is built fresh, aiming at a multi-axis input element.
- Name the clacker's parts and interactions as defined in `../GLOSSARY.md`.

## Testing

Testing is split by the kind of code:

- **Pure logic gets unit tests.** A function with no DOM access and no module-level state, such as colour conversion, page ↔ value mapping, or choosing landings, lives in an ES module in this folder, and `clacker.js` imports it. State held in a closure is fine, like the page reporter in `pages.js`. `clacker.js` keeps only the DOM, the clacker's state, pointer wiring, frame loops and rendering. `app.js`, the calling code, stays wiring, and any decision it needs goes into a tested module. A module's tests live in `test/<module>.test.js`, and they land in the same commit that adds or changes the function.
- **The only fakes are recording callbacks.** A test can pass in a spy, a function that records what it's called with, but never a fake DOM. A helper that two test files share goes in `test/testUtils.js`. Until then it sits just above the first test that uses it.
- **DOM behaviour waits for the port.** Node has no DOM, so what only the browser can show, such as `clacker.js` calling the pure logic at the right moments, goes on the checklist in DAI-75, and gets integration tests in Phase 3.
- **Tests check exact facts, never tuning values.** For example, a spring comes to rest or a coast lands on its target. "A hard flick coasts 9 ticks" is tuning, so it isn't tested.
- **Feel is checked by eye.** Easing, falls, bounces, seats and step sizes get no verification tooling. Passing tests are never evidence that the feel is right.

Run the tests from this folder with `node --test`. Node's built-in runner finds everything in `test/`, so there are still no dependencies and no `package.json`.

## Viewing

Run `./serve.sh` from this folder. It serves on all interfaces and prints the localhost and Tailscale URLs, so a phone on the tailnet can open it. It also tells browsers not to cache anything, so a phone never runs an old module after an edit. The phone should open the HTTPS URL it prints, which `tailscale serve --bg 8000` provides, because the clipboard only works over HTTPS. The plain Tailscale IP URL loads, but copying a readout value fails there. The `tailscale serve` setting persists across reboots, and `tailscale serve --https=443 off` removes it. `python3 -m http.server` from this folder also works, at http://localhost:8000, but browsers may keep old copies of files that haven't changed in a while.

Opening `index.html` directly (`file://`) doesn't work, because browsers block ES modules loaded from `file://`.

## Reference

The current clacker in the Tauri/SvelteKit app. Read these for behaviour only:

- `../apps/frontend/src/lib/Clacker.svelte`
- `../apps/frontend/src/lib/Flap.svelte`
- `../apps/frontend/src/lib/flap-model.ts`
- `../apps/frontend/src/lib/gesture-model.ts`
- `../apps/frontend/src/app.css`
