use tauri::AppHandle;

#[tauri::command]
pub async fn dispatch_sidecar(_app: AppHandle, request: String) -> Result<String, String> {
    // For now, let's implement the HTTP bridge for development as defined in AGENTS.md
    let client = reqwest::Client::new();
    let res = client
        .post("http://localhost:4001/rpc")
        .body(request)
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(body)
}
