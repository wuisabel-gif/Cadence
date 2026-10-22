// Cadence desktop: the score page in a native window, plus reading files the
// user drops on it. Scoring stays in the page's JavaScript detector.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_text])
        .run(tauri::generate_context!())
        .expect("error while running Cadence");
}
