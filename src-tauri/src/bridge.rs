use tauri::{AppHandle, Manager};
use crate::sidecar::SidecarManager;

#[tauri::command]
pub async fn dispatch_sidecar(app: AppHandle, request: String) -> Result<String, String> {
    let manager = app.state::<SidecarManager>();
    manager.send_request(&app, &request)
}
