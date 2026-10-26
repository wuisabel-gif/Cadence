// Cadence desktop: the score page in a native window, plus reading files the
// user drops on it and a global shortcut that scores the clipboard. Scoring
// stays in the page's JavaScript detector.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Same ceiling as MAX_INPUT_BYTES in deslop.mjs.
const MAX_BYTES: u64 = 5 * 1024 * 1024;

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    let size = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_BYTES {
        return Err("File is larger than 5 MiB.".into());
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|_| "Not a UTF-8 text file.".into())
}

// Cmd+Shift+. on macOS, Ctrl+Shift+. elsewhere: bring Cadence forward and
// score whatever text is on the clipboard.
fn score_clipboard_shortcut() -> Shortcut {
    let primary = if cfg!(target_os = "macos") { Modifiers::SUPER } else { Modifiers::CONTROL };
    Shortcut::new(Some(primary | Modifiers::SHIFT), Code::Period)
}

fn score_clipboard(app: &tauri::AppHandle) {
    let Ok(text) = app.clipboard().read_text() else { return };
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("score-text", text);
    }
}

fn main() {
    let shortcut = score_clipboard_shortcut();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, pressed, event| {
                    if pressed == &shortcut && event.state() == ShortcutState::Pressed {
                        score_clipboard(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Another app may own the shortcut; Cadence still works without it.
            if let Err(err) = app.global_shortcut().register(score_clipboard_shortcut()) {
                eprintln!("Cadence: could not register the clipboard shortcut: {err}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_text])
        .run(tauri::generate_context!())
        .expect("error while running Cadence");
}
