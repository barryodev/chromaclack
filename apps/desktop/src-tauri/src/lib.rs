//! Tauri v2 backend — the native half of the greeting slice.
//!
//! Wire contract (must stay byte-for-byte identical to `api/greet.rs`):
//!
//! ```jsonc
//! // invoke("greet", { name: "Barry" })
//! { "message": "hello Barry", "runtime": "tauri" }
//! ```

use serde::Serialize;
use shared_utils::format_greeting;

/// Identifies which backend produced the payload.
const RUNTIME_TAG: &str = "tauri";

/// Payload returned over IPC. Serde renames nothing, so the JSON keys match
/// the Vercel function exactly.
#[derive(Debug, Serialize)]
pub struct GreetResponse {
    message: String,
    runtime: &'static str,
}

/// `invoke("greet", { name })` — the single line of business logic is
/// delegated to `shared_utils`, exactly as the serverless function does.
#[tauri::command]
fn greet(name: &str) -> GreetResponse {
    GreetResponse {
        message: format_greeting(name),
        runtime: RUNTIME_TAG,
    }
}

/// Shared entrypoint for desktop (`main.rs`) and mobile (`#[tauri::mobile_entry_point]`).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
