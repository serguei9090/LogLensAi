mod bridge;
mod sidecar;

use sidecar::SidecarManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(SidecarManager::new())
    .invoke_handler(tauri::generate_handler![bridge::dispatch_sidecar])
    .setup(|app| {
      let manager = app.state::<SidecarManager>();
      manager.spawn(app.handle())?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
