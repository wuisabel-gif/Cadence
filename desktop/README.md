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

## Download

From v0.6.0, each release on
[GitHub Releases](https://github.com/wuisabel-gif/Cadence/releases) carries a
`.dmg` for macOS (Apple silicon and Intel), an `.msi` and `.exe` for Windows,
and `.deb`, `.rpm`, and `.AppImage` files for Linux. The release workflow builds
them from the tagged commit.

The builds are not code-signed yet. On a Mac, the first launch is blocked: open
System Settings → Privacy & Security and choose **Open Anyway**. On Windows,
SmartScreen asks you to confirm with **More info → Run anyway**.

## Not yet

- Code signing and notarization.
- A menu-bar icon or a global shortcut.
