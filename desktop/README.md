# Cadence desktop

A native macOS, Windows, and Linux app built with [Tauri](https://tauri.app).
It opens the score page in its own window. Drop a `.txt`, `.md`, or `.html` file
on the window, or open one with **Open file…** (⌘O on a Mac, Ctrl+O elsewhere). Markdown and HTML are reduced to prose first, as with
`--prose-only`. Scoring runs locally with the same detector as the CLI; no text
leaves your computer.

## Build

Needs Node 20 or newer and a Rust toolchain. From the repository root:

```bash
npm run desktop:build
```

The app and installer land in `desktop/src-tauri/target/release/bundle/`. On a
Mac that is `macos/Cadence.app` and a `.dmg`. For a live-reloading window while
you edit, run `npm run desktop:dev`.

The build copies `check.html`, `extension/detector.js`, and `desktop/desktop.js`
into `desktop/dist/`. Edit those sources, not `dist/`.

## Not yet

- Builds are not code-signed, so macOS asks you to confirm the first launch
  (right-click the app, then Open).
- No menu-bar icon or global shortcut yet.
- Release builds are made by hand; CI does not build the app.
