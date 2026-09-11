//! `POST /api/greet` — the cloud half of the greeting slice.
//!
//! Wire contract (must stay byte-for-byte identical to the Tauri
//! `greet` command in `apps/desktop/src-tauri/src/lib.rs`):
//!
//! ```jsonc
//! // request
//! { "name": "Barry" }
//! // response 200
//! { "message": "hello Barry", "runtime": "vercel" }
//! // response 4xx/5xx
//! { "error": "..." }
//! ```

use http_body_util::BodyExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use shared_utils::format_greeting;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};

/// Identifies which backend produced the payload. The frontend renders this
/// next to its own transport badge so a mismatch is immediately visible.
const RUNTIME_TAG: &str = "vercel";

/// Incoming JSON body.
#[derive(Debug, Deserialize)]
struct GreetRequest {
    name: String,
}

/// Outgoing JSON body on success.
#[derive(Debug, Serialize)]
struct GreetResponse {
    message: String,
    runtime: &'static str,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    if req.method().as_str() != "POST" {
        return error_response(405, "method not allowed, use POST");
    }

    // `Request` is `http::Request<hyper::body::Incoming>`, so the body is a
    // stream that has to be collected before it can be deserialized.
    let bytes = req.into_body().collect().await?.to_bytes();

    let payload: GreetRequest = match serde_json::from_slice(&bytes) {
        Ok(payload) => payload,
        Err(err) => return error_response(400, &format!("invalid JSON body: {err}")),
    };

    // The single line of business logic — identical to the Tauri command.
    let body = GreetResponse {
        message: format_greeting(&payload.name),
        runtime: RUNTIME_TAG,
    };

    Ok(Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .header("cache-control", "no-store")
        .body(ResponseBody::from(serde_json::to_value(&body)?))?)
}

/// Builds an error body in the shape the frontend's `ApiError` expects.
fn error_response(status: u16, message: &str) -> Result<Response<ResponseBody>, Error> {
    Ok(Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .header("cache-control", "no-store")
        .body(ResponseBody::from(json!({ "error": message })))?)
}
