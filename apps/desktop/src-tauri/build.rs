fn main() {
    // Generates the ACL schemas under src-tauri/gen/schemas/ that
    // capabilities/default.json validates against.
    //
    // To lock the IPC surface down to an explicit allowlist instead of
    // Tauri's default "all registered commands are callable", swap this for:
    //
    //   tauri_build::try_build(
    //       tauri_build::Attributes::new().app_manifest(
    //           tauri_build::AppManifest::new().commands(&["greet"]),
    //       ),
    //   )
    //   .expect("failed to run tauri-build");
    //
    // ...and then add the generated `allow-greet` permission to
    // capabilities/default.json.
    tauri_build::build();
}
