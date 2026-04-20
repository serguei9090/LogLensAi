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
                .arg("../sidecar/main.py")
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
            .map_err(|e| format!("Failed to spawn sidecar (CWD: {:?}): {}", std::env::current_dir(), e))?;

        *child_guard = Some(child);
        Ok(())
    }

    pub fn send_request(&self, app: &AppHandle, request: &str) -> Result<String, String> {
        let mut child_guard = self.child.lock().unwrap();

        // 1. Check if child is alive, if not try to re-spawn
        let mut is_dead = true;
        if let Some(child) = child_guard.as_mut() {
            if let Ok(None) = child.try_wait() {
                is_dead = false;
            }
        }

        if is_dead {
            *child_guard = None; // Reset
            drop(child_guard); // Release lock to avoid deadlock in spawn
            self.spawn(app)?;
            child_guard = self.child.lock().unwrap();
        }

        let child = child_guard.as_mut().ok_or("Sidecar failed to start")?;

        // 2. Attempt to send request with one retry on failure
        let res = self.write_and_read(child, request);
        
        if res.is_err() {
            // If it failed, maybe the pipe just died/closed unexpectedly
            *child_guard = None;
            drop(child_guard);
            self.spawn(app)?;
            child_guard = self.child.lock().unwrap();
            let child = child_guard.as_mut().ok_or("Sidecar failed to restart")?;
            return self.write_and_read(child, request);
        }

        res
    }

    fn write_and_read(&self, child: &mut Child, request: &str) -> Result<String, String> {
        let stdin = child.stdin.as_mut().ok_or("Failed to open stdin")?;
        stdin.write_all(request.as_bytes()).map_err(|e| e.to_string())?;
        stdin.write_all(b"\n").map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;

        let stdout = child.stdout.as_mut().ok_or("Failed to open stdout")?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;

        if line.is_empty() {
             return Err("Empty response from sidecar (process likely exited)".into());
        }

        Ok(line)
    }
}
