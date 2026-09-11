/**
 * The environment adapter.
 *
 * One call site in the UI, two runtimes underneath:
 *   - inside a Tauri webview  -> `invoke('greet')` over IPC
 *   - in a plain browser      -> `fetch('/api/greet')` to the Rust function
 *
 * Both paths resolve to the same {@link GreetResponse} shape, so the Svelte
 * component never branches on environment.
 */

import type { ApiErrorBody, GreetRequest, GreetResponse, GreetResult } from './types';

/**
 * Globals Tauri injects into the webview.
 *
 * `__TAURI_INTERNALS__` is always present in Tauri v2. `__TAURI__` only
 * appears when `app.withGlobalTauri` is true in `tauri.conf.json` (it is, in
 * this template). Checking both means the adapter keeps working if you later
 * turn the global off.
 */
const TAURI_GLOBALS = ['__TAURI_INTERNALS__', '__TAURI__'] as const;

/** Thrown when a backend answers with a non-2xx status or an unusable body. */
export class ApiError extends Error {
	/** HTTP status, when the failure came from the Vercel function. */
	readonly status: number | undefined;

	constructor(message: string, status?: number) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

/**
 * True when running inside a Tauri webview (desktop or mobile).
 *
 * Guarded on `typeof window` so it stays safe if this module is ever
 * imported from a non-browser context.
 */
export function isTauri(): boolean {
	if (typeof window === 'undefined') return false;
	return TAURI_GLOBALS.some((key) => key in window);
}

/** The transport {@link greet} will use, without performing a call. */
export function activeTransport(): GreetResult['transport'] {
	return isTauri() ? 'tauri-ipc' : 'vercel-fetch';
}

/**
 * Sends `name` to whichever backend is available and returns its greeting
 * together with the transport that carried it.
 *
 * @throws {ApiError} when the backend rejects the request or is unreachable.
 */
export async function greet(name: string): Promise<GreetResult> {
	const args: GreetRequest & Record<string, unknown> = { name };

	if (isTauri()) {
		// Dynamic import keeps @tauri-apps/api out of the initial web bundle;
		// Vite emits it as a lazy chunk the browser build never requests.
		const { invoke } = await import('@tauri-apps/api/core');
		try {
			const response = await invoke<GreetResponse>('greet', args);
			return { ...response, transport: 'tauri-ipc' };
		} catch (cause) {
			throw new ApiError(typeof cause === 'string' ? cause : 'Tauri command "greet" failed');
		}
	}

	let response: Response;
	try {
		response = await fetch('/api/greet', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(args)
		});
	} catch {
		throw new ApiError('Could not reach /api/greet — is the function running?');
	}

	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
		throw new ApiError(body?.error ?? `Request failed with ${response.status}`, response.status);
	}

	const payload = (await response.json()) as GreetResponse;
	return { ...payload, transport: 'vercel-fetch' };
}
