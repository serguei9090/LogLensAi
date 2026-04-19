use std::process::{Child, Command, Stdio};
use std::io::{Write, BufReader, BufRead};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

pub struct SidecarManager {
    child: Arc<Mutex<Option<Child>>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(Option::None)),
        }
    }

    pub fn spawn(&self, app: &AppHandle) -> Result<(), String> {
        let mut child_guard = self.child.lock().unwrap();
        if child_guard.is_some() {
            return Ok(());
        }

        // Determine if we are in dev mode or prod
        // For dev: uv run sidecar/main.py --stdio
        // For prod: sidecar binary (Tauri sidecar)
        
        let mut cmd = if cfg!(debug_assertions) {
            let mut c = Command::new("uv");
            c.arg("run")
                .arg("sidecar/main.py")
                .arg("--stdio");
            c
        } else {
            // Production: Use Tauri sidecar binary
            // This requires sidecar configuration in tauri.conf.json
            app.shell().sidecar("sidecar").map_err(|e| e.to_string())?.into()
        };

        let child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

        *child_guard = Some(child);
        Ok(())
    }

    pub fn send_request(&self, request: &str) -> Result<String, String> {
        let mut child_guard = self.child.lock().unwrap();
        let child = child_guard.as_mut().ok_or("Sidecar not running")?;

        let stdin = child.stdin.as_mut().ok_or("Failed to open stdin")?;
        stdin.write_all(request.as_bytes()).map_err(|e| e.to_string())?;
        stdin.write_all(b"\n").map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;

        let stdout = child.stdout.as_mut().ok_or("Failed to open stdout")?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;

        Ok(line)
    }
}
