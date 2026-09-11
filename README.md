# tauri-vercel-monorepo

One SvelteKit SPA, two backends, one shared Rust crate.

| Target                  | Frontend                                          | Backend                  | Entry point                         |
| ----------------------- | ------------------------------------------------- | ------------------------ | ----------------------------------- |
| Web (Vercel)            | `apps/frontend` → static `build/`                 | Rust serverless function | `api/greet.rs`                      |
| Desktop / Android / iOS | the _same_ `build/` output, loaded by the webview | Tauri v2 command         | `apps/desktop/src-tauri/src/lib.rs` |

Both backends call `shared_utils::format_greeting`. The frontend never branches
on environment — `packages/services/api.ts` does that once, and everything above
it is transport-agnostic.

---

## 1. Directory structure

```
.
├── Cargo.toml                       # Cargo workspace root AND the `api` package
├── package.json                     # pnpm workspace root + Turborepo scripts
├── pnpm-workspace.yaml
├── turbo.json
├── vercel.json                      # static output + Rust functions + SPA rewrite
├── rust-toolchain.toml
├── rustfmt.toml / clippy.toml
├── eslint.config.js / .prettierrc
├── .vercelignore
│
├── api/                             # Vercel serverless functions (Rust)
│   └── greet.rs                     #   -> POST /api/greet   [[bin]] name = "greet"
│
├── crates/
│   └── shared_utils/                # the crate both backends depend on
│       ├── Cargo.toml
│       └── src/lib.rs               #   format_greeting(&str) -> String
│
├── packages/
│   ├── services/                    # @repo/services — the environment adapter
│   │   ├── api.ts                   #   isTauri() ? invoke() : fetch()
│   │   ├── types.ts                 #   the wire contract, single source of truth
│   │   └── index.ts
│   └── tsconfig/                    # @repo/tsconfig — shared compiler options
│       └── base.json
│
└── apps/
    ├── frontend/                    # @repo/frontend — SvelteKit SPA
    │   ├── svelte.config.js         #   adapter-static + fallback
    │   ├── vite.config.ts
    │   ├── static/favicon.png
    │   └── src/
    │       ├── app.html
    │       ├── app.css
    │       └── routes/
    │           ├── +layout.ts       #   ssr = false, prerender = false
    │           ├── +layout.svelte
    │           └── +page.svelte     #   text box + button + transport badge
    │
    └── desktop/                     # @repo/desktop — Tauri v2 shell
        ├── package.json             #   wraps @tauri-apps/cli
        └── src-tauri/
            ├── Cargo.toml           #   workspace member
            ├── build.rs
            ├── tauri.conf.json      #   frontendDist -> ../../frontend/build
            ├── capabilities/default.json
            ├── icons/
            └── src/
                ├── lib.rs           #   #[tauri::command] greet
                └── main.rs
```

### Why the JS and Rust workspaces overlap instead of nesting

`pnpm-workspace.yaml` claims `apps/*` and `packages/*`. The Cargo workspace claims
`crates/shared_utils`, `apps/desktop/src-tauri` and the repo root itself. They
coexist because neither tool cares about the other's members — `apps/desktop` is a
pnpm package whose _subdirectory_ `src-tauri` is a Cargo package, which is exactly
how the Tauri CLI expects to find things.

---

## 2. Static compilation

### `apps/frontend/svelte.config.js`

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html', // required: nothing is prerendered
			precompress: false,
			strict: true
		})
	}
};

export default config;
```

### `apps/frontend/src/routes/+layout.ts`

```ts
export const prerender = false; // don't crawl/snapshot routes at build time
export const ssr = false; // emit no server code; client-only render
export const csr = true; // client-side routing still works
export const trailingSlash = 'never';
```

Set in the **root** layout so every route inherits them. Together with the
adapter's `fallback`, this produces a genuine SPA: one `index.html`, a hashed
`_app/immutable/*` bundle, no Node server anywhere. That is the only shape Tauri
can load (it serves files off a custom protocol, not an origin) and it is what
lets Vercel treat the output as plain static assets sitting beside the functions.

**Leave `paths.relative` at its default (`false`).** Root-absolute asset URLs are
what make deep links work on Vercel, where `/any/deep/link` is rewritten to the
same `index.html`; relative URLs would resolve against the requested path and 404. Tauri serves the bundle from the root of its protocol, so absolute paths are
correct there too.

---

## 3. `vercel.json`

```jsonc
{
	"framework": null,
	"installCommand": "pnpm install --frozen-lockfile",
	"buildCommand": "pnpm turbo run build --filter=@repo/frontend",
	"outputDirectory": "apps/frontend/build",
	"functions": { "api/**/*.rs": { "memory": 1024, "maxDuration": 15 } },
	"rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
	"headers": [/* immutable cache for /_app/immutable/* */]
}
```

Set the Vercel project's **Root Directory to the repo root** (not `apps/frontend`)
— `api/` has to be at the deployment root for the runtime to find it, and the
Cargo workspace has to be intact for `shared_utils` to resolve.

- `framework: null` stops Vercel auto-detecting SvelteKit and swapping in
  `adapter-vercel`, which would produce serverless render functions instead of
  static output.
- The rewrite is the SPA fallback. Vercel evaluates `rewrites` **after** the
  filesystem, so real files (`/_app/immutable/*.js`, `/favicon.png`) and the
  detected functions under `/api/*` are served first; only genuine misses reach
  `index.html`. The `(?!api/)` lookahead is belt-and-braces.
- `.rs` files in `api/` are picked up by Vercel's **native Rust runtime**, so no
  `runtime` key is needed. (The old `vercel-rust@4.x` community builder was
  archived in January 2026 and expects the v1 `Body` API, not the
  `hyper::body::Incoming` request type this template is written against — don't
  pin it.)

---

## 4. Cargo workspace

`Cargo.toml` at the repo root is **both** the workspace root and the package that
owns the serverless binaries, because Vercel's Rust runtime expects a real
`Cargo.toml` at the deployment root with one `[[bin]]` per handler.

```toml
[workspace]
resolver = "2"
members = ["crates/shared_utils", "apps/desktop/src-tauri"]
default-members = ["."]          # a bare `cargo build` builds ONLY the functions

[workspace.dependencies]
shared_utils = { path = "crates/shared_utils" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }

[package]
name = "api"

[[bin]]
name = "greet"                   # api/greet.rs  ->  POST /api/greet
path = "api/greet.rs"

[dependencies]
shared_utils = { workspace = true }   # <-- same crate the Tauri app uses
vercel_runtime = "2"
http-body-util = "0.1"
# ...

[profile.release]                # profiles only work in the workspace root
codegen-units = 1
lto = "fat"
opt-level = 3
strip = true
```

Both consumers then say the same thing:

```toml
# apps/desktop/src-tauri/Cargo.toml        # Cargo.toml (root, the api package)
shared_utils = { workspace = true }        shared_utils = { workspace = true }
```

**`default-members = ["."]` is load-bearing.** The desktop crate links against
webkit2gtk/wry, which a serverless Linux build image does not have. Restricting
the default member set means Vercel's `cargo build` never touches it. Use
`cargo build --workspace` locally when you do want everything.

`.vercelignore` drops the desktop crate's icons, `gen/` and `target/` but
**keeps its `Cargo.toml` and `src/`** — remove those and Cargo refuses to load
the workspace at all.

---

## 5. The hello-world slice

### `crates/shared_utils/src/lib.rs`

```rust
pub fn format_greeting(name: &str) -> String {
    let trimmed = name.trim();
    let subject = if trimmed.is_empty() { "world" } else { trimmed };
    format!("hello {subject}")
}
```

### `apps/desktop/src-tauri/src/lib.rs`

```rust
#[derive(Debug, Serialize)]
pub struct GreetResponse { message: String, runtime: &'static str }

#[tauri::command]
fn greet(name: &str) -> GreetResponse {
    GreetResponse { message: format_greeting(name), runtime: "tauri" }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### `apps/desktop/src-tauri/capabilities/default.json`

```json
{
	"$schema": "../gen/schemas/desktop-schema.json",
	"identifier": "default",
	"description": "Baseline permissions granted to the main window on every platform.",
	"windows": ["main"],
	"permissions": [
		"core:default",
		"core:app:default",
		"core:event:default",
		"core:path:default",
		"core:webview:default",
		"core:window:default"
	]
}
```

**Read this carefully, it is the most-misunderstood part of Tauri v2.** In v2,
_your own_ `#[tauri::command]` functions are callable by every window by default
— there is no `allow-greet` permission to add here, and inventing one makes the
build fail. What the capability file grants is the **core** ACL, and `invoke()`
does not work without it: the IPC plumbing and event channels live behind
`core:event` / `core:webview`. A missing or mislabelled capability is why a
command "silently does nothing".

Two things that actually matter:

- `"windows": ["main"]` must match the `label` of the window in
  `tauri.conf.json`. The template sets `"label": "main"` explicitly — the
  default label is also `main`, but relying on that is how this breaks.
- The file must exist in `src-tauri/capabilities/`. Tauri auto-loads everything
  there; you don't reference it from `tauri.conf.json`.

To _restrict_ the IPC surface to an explicit allowlist instead, switch `build.rs`
to `tauri_build::try_build(Attributes::new().app_manifest(AppManifest::new().commands(&["greet"])))`
and then add the generated `allow-greet` permission to the list above. The
commented-out snippet is in `build.rs`.

### `api/greet.rs`

```rust
async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    if req.method().as_str() != "POST" {
        return error_response(405, "method not allowed, use POST");
    }
    // Request is http::Request<hyper::body::Incoming> — a stream, so collect it.
    let bytes = req.into_body().collect().await?.to_bytes();
    let payload: GreetRequest = match serde_json::from_slice(&bytes) { /* ... */ };

    let body = GreetResponse { message: format_greeting(&payload.name), runtime: "vercel" };

    Ok(Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .body(ResponseBody::from(serde_json::to_value(&body)?))?)
}
```

### `packages/services/api.ts` — the environment adapter

```ts
const TAURI_GLOBALS = ['__TAURI_INTERNALS__', '__TAURI__'] as const;

export function isTauri(): boolean {
	if (typeof window === 'undefined') return false;
	return TAURI_GLOBALS.some((key) => key in window);
}

export async function greet(name: string): Promise<GreetResult> {
	const args: GreetRequest = { name };

	if (isTauri()) {
		const { invoke } = await import('@tauri-apps/api/core'); // lazy chunk
		const response = await invoke<GreetResponse>('greet', args);
		return { ...response, transport: 'tauri-ipc' };
	}

	const response = await fetch('/api/greet', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(args)
	});
	if (!response.ok) throw new ApiError(/* ... */);
	return { ...(await response.json()), transport: 'vercel-fetch' };
}
```

Two deliberate choices:

- **`__TAURI_INTERNALS__` is checked first.** `window.__TAURI__` only exists when
  `app.withGlobalTauri` is `true` in `tauri.conf.json` (this template sets it, so
  your `window.__TAURI__` check works as specified); `__TAURI_INTERNALS__` is
  always injected by Tauri v2. Checking both means turning the global off later
  doesn't silently route the desktop app through `fetch`.
- **`@tauri-apps/api` is imported dynamically.** A static import would pull the
  IPC shim into the initial web bundle. Vite emits it as a lazy chunk the browser
  build never requests.

The wire contract lives once, in `packages/services/types.ts`, and both Rust
handlers serialize exactly that shape:

```jsonc
// request        { "name": "Barry" }
// response 200   { "message": "hello Barry", "runtime": "tauri" | "vercel" }
// response 4xx   { "error": "..." }
```

### `apps/frontend/src/routes/+page.svelte`

Svelte 5 runes; the component calls `greet(name)` and renders
`result.message` beside a badge driven by `result.transport`
(`Tauri IPC` / `Vercel Fetch`) and the backend's self-reported `runtime`. If the
two ever disagree you have a routing bug, visible at a glance.

---

## Getting started

### Prerequisites

On Ubuntu, install the Rust toolchain and desktop build dependencies before the
first local run:

```bash
curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
source "$HOME/.cargo/env"

sudo apt-get update
sudo apt-get install -y \
  build-essential pkg-config \
  libdbus-1-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Local verification

```bash
cd /home/barryodev/dev/chromaclack
source "$HOME/.cargo/env"
pnpm install
pnpm verify
```

This is the repo's full validation pass: format, lint, TypeScript checks,
`cargo clippy`, Rust tests, and the build.

### Local web stack (real deployment parity)

The browser code expects a live `/api/greet` function. Plain `pnpm --filter
@repo/frontend dev` only serves the Svelte SPA and returns 404 for `/api/greet`.
For true local parity with the deployment model, run the Vercel runtime locally:

```bash
cd /home/barryodev/dev/chromaclack
source "$HOME/.cargo/env"
npx vercel dev
```

Then open the localhost URL Vercel prints, typically `http://localhost:3000`.
This serves the static frontend and the Rust function together, matching the real
web deployment shape.

### Local desktop app

The Tauri app is best run with the frontend and the desktop processes separated
into different terminals:

```bash
# terminal 1
cd /home/barryodev/dev/chromaclack
source "$HOME/.cargo/env"
pnpm --filter @repo/frontend dev
```

```bash
# terminal 2
cd /home/barryodev/dev/chromaclack
source "$HOME/.cargo/env"
pnpm --filter @repo/desktop tauri dev
```

Running the desktop command alone may terminate the Vite child process when the
outer dev process exits; splitting the two commands keeps the app stable.

### Mobile

```bash
pnpm --filter @repo/desktop android:init     # once; needs Android SDK + NDK
pnpm dev:android
```

Uncomment the Android targets in `rust-toolchain.toml` first. `TAURI_DEV_HOST` is
already wired through `vite.config.ts` so a physical device can reach the dev
server over the LAN.

### Icons

`apps/desktop/src-tauri/icons/` holds generated placeholders. Replace them with
`pnpm --filter @repo/desktop icons` pointed at your own artwork — macOS bundling
additionally needs an `.icns`, which `tauri icon` produces.

---

## Verification status

The repo has been verified locally in this environment after installing the Rust
and Ubuntu build dependencies. The current proof command is:

```bash
cd /home/barryodev/dev/chromaclack
source "$HOME/.cargo/env"
pnpm install
pnpm verify
```

This completed successfully with exit code `0`, which means the repository is in a
healthy state for local development:

- formatting passes
- ESLint passes
- TypeScript checks pass
- `cargo clippy` passes
- Rust tests pass
- the project builds successfully

The non-obvious learning from this project is that plain Vite web mode and the
real Vercel/Rust web stack are not equivalent. For the browser path to hit the
serverless function, the app must be run through Vercel local dev, while desktop
mode remains a separate Tauri launch path.

The npm versions are caret ranges rather than a pinned lockfile for the same
reason; `pnpm install` will write `pnpm-lock.yaml` and `cargo` will write
`Cargo.lock`, and both should be committed for reproducible builds.
