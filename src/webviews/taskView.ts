import * as vscode from 'vscode';

export class TaskView {
  public static currentPanel: TaskView | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(extensionUri: vscode.Uri, task: any) {
    this._panel = vscode.window.createWebviewPanel(
      'taskDetails',
      `Exercise: ${task.name}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    this._panel.dispose();
  }

  public static createOrShow(extensionUri: vscode.Uri, task: any): void {
    vscode.window.showInformationMessage(`Viewing exercise: ${task.name}`);
  }

  public dispose(): void {
    TaskView.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}