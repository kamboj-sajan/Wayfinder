import * as vscode from "vscode";
import { runWayfinder } from "./wayfinderRunner";
import { WayfinderViewProvider } from "./wayfinderView";

export function activate(context: vscode.ExtensionContext) {
  console.log("Wayfinder extension activating");

  // Command
  context.subscriptions.push(
    vscode.commands.registerCommand("wayfinder.start", runWayfinder)
  );

  // Status bar button
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = "▶ Wayfinder Test";
  statusBarItem.tooltip = "Start a Wayfinder run";
  statusBarItem.command = "wayfinder.start";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ✅ REGISTER VIEW PROVIDER (THIS FIXES THE ERROR)
  const provider = new WayfinderViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "wayfinderView",
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}

export function deactivate() {}
