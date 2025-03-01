import * as vscode from 'vscode';
import * as cp from 'child_process';
import { getPythonCommand } from './utils/paths';

export class DependencyManager {
  public async checkPythonDependencies(): Promise<boolean> {
    try {
      const pythonCmd = getPythonCommand();
      cp.execSync(`${pythonCmd} --version`);

      try {
        cp.execSync(`${pythonCmd} -c "import pytest"`);
        return true;
      } catch (error) {
        const installButton = 'Install pytest';
        const response = await vscode.window.showErrorMessage(
          'pytest is required but not found. Would you like to install it?',
          installButton
        );

        if (response === installButton) {
          return await this.installPytest();
        }
        return false;
      }
    } catch (error) {
      vscode.window.showErrorMessage('Python is not installed or not in PATH. Please install Python 3.6+.');
      return false;
    }
  }

  private async installPytest(): Promise<boolean> {
    try {
      const pythonCmd = getPythonCommand();
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing pytest...',
        cancellable: false
      }, async (progress) => {
        return new Promise<void>((resolve, reject) => {
          const process = cp.exec(`${pythonCmd} -m pip install pytest`);

          process.on('close', (code) => {
            if (code === 0) {
              vscode.window.showInformationMessage('pytest installed successfully.');
              resolve();
            } else {
              reject(new Error(`Failed to install pytest (exit code: ${code})`));
            }
          });

          process.on('error', reject);
        });
      });
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to install pytest: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}