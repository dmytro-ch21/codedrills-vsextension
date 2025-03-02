import * as vscode from 'vscode';
import { TaskProvider } from './taskProvider';
import { TaskTreeDataProvider } from './taskTreeDataProvider';
import { TestRunner } from './testRunner';
import { ReportGenerator } from './reportGenerator';
import * as fs from 'fs';
import * as path from 'path';
import { showTemporaryInformationMessage, showTemporaryErrorMessage } from './utils/notifications';
import { DependencyManager } from './dependencyManager';

let globalState: {
  disposables?: vscode.Disposable[];
} | undefined;

export function globalStateForTesting(): any {
  return globalState;
}

export async function activate(context: vscode.ExtensionContext) {
  await vscode.commands.executeCommand('setContext', 'codeDrills.active', true);

  globalState = { disposables: [] };
  console.log('CodeDrills extension is now active');

  const dependencyManager = new DependencyManager();
  const dependenciesOk = await dependencyManager.checkPythonDependencies();

  if (!dependenciesOk) {
    vscode.window.showWarningMessage('CodeDrills: Some dependencies are missing. Python test execution may not work properly.');
  }

  const taskProvider = new TaskProvider(context);
  const testRunner = new TestRunner();
  const reportGenerator = new ReportGenerator(context.extensionUri);

  const taskTreeDataProvider = new TaskTreeDataProvider(taskProvider);
  vscode.window.registerTreeDataProvider('codeDrillsExplorer', taskTreeDataProvider);

  async function findSolutionFile(exercisePath: string): Promise<vscode.Uri | undefined> {
    try {
      const files = fs.readdirSync(exercisePath);

      const solutionFilePatterns = [
        /^solution\.(py|js|ts|java|cpp|cs)$/,
        /^(main|index)\.(py|js|ts|java|cpp|cs)$/,
        /^[^test_].*\.(py|js|ts|java|cpp|cs)$/
      ];

      const potentialSolutionFiles = files.filter(file => {
        if (file === 'README.md' || file.startsWith('test_') ||
          file.endsWith('_test.py') || file.includes('.test.') ||
          file.startsWith('.')) {
          return false;
        }

        return solutionFilePatterns.some(pattern => pattern.test(file));
      });

      if (potentialSolutionFiles.length > 0) {
        const solutionFile = potentialSolutionFiles.find(file =>
          file.startsWith('solution.')) || potentialSolutionFiles[0];

        return vscode.Uri.file(path.join(exercisePath, solutionFile));
      }

      return undefined;
    } catch (error) {
      console.error(`Error finding solution file: ${error}`);
      return undefined;
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('codeDrills.refreshExercises', () => {
      taskProvider.refresh();
      taskTreeDataProvider.refresh();
      showTemporaryInformationMessage('Practice exercises refreshed');
    }),

    vscode.commands.registerCommand('codeDrills.openExercise', async (taskPath: string) => {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');

      const readmePath = vscode.Uri.file(`${taskPath}/README.md`);
      const solutionFile = await findSolutionFile(taskPath);

      await vscode.commands.executeCommand('setContext', 'codeDrills.isExerciseReadme', true);

      if (solutionFile) {
        const solutionDocument = await vscode.workspace.openTextDocument(solutionFile);
        await vscode.window.showTextDocument(solutionDocument, { viewColumn: vscode.ViewColumn.One, preview: false });

        const readmeDocument = await vscode.workspace.openTextDocument(readmePath);
        await vscode.commands.executeCommand('markdown.showPreviewToSide', readmeDocument.uri);
      } else {
        const readmeDocument = await vscode.workspace.openTextDocument(readmePath);
        await vscode.commands.executeCommand('markdown.showPreview', readmeDocument.uri);
      }
    }),

    vscode.commands.registerCommand('codeDrills.nextExercise', async () => {
      const currentTask = taskProvider.getCurrentTaskFromEditor();
      if (currentTask) {
        const nextTask = taskProvider.getNextTask(currentTask);
        if (nextTask) {
          vscode.commands.executeCommand('codeDrills.openExercise', nextTask.path);
        } else {
          showTemporaryInformationMessage('No next exercise available');
        }
      }
    }),

    vscode.commands.registerCommand('codeDrills.previousExercise', async () => {
      const currentTask = taskProvider.getCurrentTaskFromEditor();
      if (currentTask) {
        const prevTask = taskProvider.getPreviousTask(currentTask);
        if (prevTask) {
          vscode.commands.executeCommand('codeDrills.openExercise', prevTask.path);
        } else {
          vscode.window.showInformationMessage('No previous exercise available');
        }
      }
    }),

    vscode.commands.registerCommand('codeDrills.runTests', async (taskItem) => {
      let taskPath: string;

      if (taskItem && taskItem.path) {
        taskPath = taskItem.path;
      } else {
        const currentTask = taskProvider.getCurrentTaskFromEditor();
        if (currentTask) {
          taskPath = currentTask.path;
        } else {
          vscode.window.showErrorMessage('No exercise found to run tests on');
          return;
        }
      }

      const tokenSource = new vscode.CancellationTokenSource();
      const timeout = setTimeout(() => tokenSource.cancel(), 120000);

      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Running tests...',
          cancellable: true
        }, async (progress, token) => {
          token.onCancellationRequested(() => {
            tokenSource.cancel();
          });

          try {
            const result = await testRunner.runTests(taskPath);

            if (result.success) {
              vscode.window.showInformationMessage(`Tests passed for exercise: ${result.taskName}`);
            } else {
              vscode.window.showErrorMessage(`Tests failed for exercise: ${result.taskName}`);
            }

            taskProvider.updateTaskStatus(taskPath, result);
            taskTreeDataProvider.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(`Error running tests: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to execute tests: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timeout);
        tokenSource.dispose();
      }
    }),

    vscode.commands.registerCommand('codeDrills.generateReport', async () => {
      const reportPath = await reportGenerator.generateReport(taskProvider.getTasks());
      
      const uri = vscode.Uri.file(reportPath);
      
      try {
        await vscode.commands.executeCommand('htmlPreview.openPreview', uri);
      } catch (error) {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        
        vscode.env.openExternal(uri);
      }
      
      vscode.window.showInformationMessage(`Practice progress report generated at: ${reportPath}`);
    }),

    vscode.commands.registerCommand('codeDrills.clearTestResults', () => {
      taskProvider.clearTaskStatuses();
      taskTreeDataProvider.refresh();
      showTemporaryInformationMessage('Test results cleared');
    })
  );

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      const document = editor.document;
      if (document.fileName.endsWith('README.md')) {
        const directoryPath = path.dirname(document.uri.fsPath);
        const isExerciseReadme = !!taskProvider.getTaskByPath(directoryPath);
        
        vscode.commands.executeCommand('setContext', 'codeDrills.isExerciseReadme', isExerciseReadme);
      } else {
        vscode.commands.executeCommand('setContext', 'codeDrills.isExerciseReadme', false);
      }
    }
  }));

  taskProvider.refresh();
}

export function deactivate() { 
  vscode.commands.executeCommand('setContext', 'codeDrills.active', false);

  if (globalState) {
    for (const terminal of vscode.window.terminals) {
      if (terminal.name === 'CodeDrills Tests') {
        terminal.dispose();
      }
    }
    globalState = undefined;
  }
  
  console.log('CodeDrills extension has been deactivated');
}
