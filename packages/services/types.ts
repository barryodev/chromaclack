/**
 * The wire contract shared by both backends.
 *
 * `apps/desktop/src-tauri/src/lib.rs` and `api/greet.rs` both serialize
 * exactly this shape — keep all three in step.
 */

/** Request body for `POST /api/greet` and args for `invoke('greet', ...)`. */
export interface GreetRequest {
	name: string;
}

/** Successful payload, identical across Tauri IPC and the Vercel function. */
export interface GreetResponse {
	message: string;
	/** Which backend produced the payload. */
	runtime: 'tauri' | 'vercel';
}

/** Error payload returned by the Vercel function on 4xx/5xx. */
export interface ApiErrorBody {
	error: string;
}

/** Which code path the frontend actually took to reach a backend. */
export type Transport = 'tauri-ipc' | 'vercel-fetch';

/** Human-readable label for the UI badge. */
export const TRANSPORT_LABEL: Record<Transport, string> = {
	'tauri-ipc': 'Tauri IPC',
	'vercel-fetch': 'Vercel Fetch'
};

/** A backend response plus the transport that delivered it. */
export interface GreetResult extends GreetResponse {
	transport: Transport;
}
