/**
 * Webapp updater is deactivated for standalone local-first APK.
 * The packaged APK assets and local IndexedDB are authoritative.
 */
export async function downloadWebappUpdate() {
  return;
}
