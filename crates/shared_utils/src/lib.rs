//! Business logic shared by every backend target.
//!
//! Anything in this crate compiles for desktop, Android/iOS (via Tauri) and
//! the Vercel serverless Linux target. Keep it free of platform-specific
//! dependencies so both consumers stay in sync by construction.

/// Default name used when the caller supplies nothing usable.
const FALLBACK_NAME: &str = "world";

/// Builds the canonical greeting for `name`.
///
/// Surrounding whitespace is trimmed, and blank input falls back to
/// [`FALLBACK_NAME`] so both transports return an identical, well-formed
/// message for empty submissions.
///
/// # Examples
///
/// ```
/// use shared_utils::format_greeting;
///
/// assert_eq!(format_greeting("Barry"), "hello Barry");
/// assert_eq!(format_greeting("  Barry  "), "hello Barry");
/// assert_eq!(format_greeting("   "), "hello world");
/// ```
#[must_use]
pub fn format_greeting(name: &str) -> String {
    let trimmed = name.trim();
    let subject = if trimmed.is_empty() {
        FALLBACK_NAME
    } else {
        trimmed
    };
    format!("hello {subject}")
}

#[cfg(test)]
mod tests {
    use super::format_greeting;

    #[test]
    fn prefixes_the_name() {
        assert_eq!(format_greeting("Barry"), "hello Barry");
    }

    #[test]
    fn trims_surrounding_whitespace() {
        assert_eq!(format_greeting("\t Barry \n"), "hello Barry");
    }

    #[test]
    fn falls_back_on_blank_input() {
        assert_eq!(format_greeting(""), "hello world");
        assert_eq!(format_greeting("     "), "hello world");
    }

    #[test]
    fn preserves_unicode() {
        assert_eq!(format_greeting("Síle"), "hello Síle");
    }
}
