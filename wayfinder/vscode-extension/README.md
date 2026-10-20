# Wayfinder for VS Code

Start a [Wayfinder](https://github.com/kamboj-sajan/Wayfinder) run without
leaving the editor. Wayfinder is an autonomous testing agent: point it at a URL
and it explores the running app in a real browser, checks every step for failed
network calls, console errors and unexpected navigation, and saves the run to
the Wayfinder dashboard.

## Usage

Open the Wayfinder project folder in VS Code, then start a run from any of:

- **▶ Wayfinder Test** in the status bar
- the **Wayfinder** panel in the activity bar
- **▶ Start Wayfinder Test** in the Command Palette

Enter the URL to test and choose whether to show the browser. The agent runs in
a **Wayfinder Test** terminal; press Ctrl+C there to stop it after the current
step.

## Requirements

- The Wayfinder repository open as the workspace (the extension runs the agent
  from its `runtime-discovery/` folder) with dependencies installed
- `runtime-discovery/.env` configured with the API URL and key, and optionally
  `WAYFINDER_LOGIN_USERNAME` / `WAYFINDER_LOGIN_PASSWORD` for sites behind a login
