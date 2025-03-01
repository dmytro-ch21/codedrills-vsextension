import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getPythonCommand, getTempFilePath } from './utils/paths';

export interface TestResult {
  taskPath: string;
  taskName: string;
  success: boolean;
  message?: string;
  testsPassed?: number;
  testsFailed?: number;
  testsRun?: number;
}

export class TestRunner {
  private terminal: vscode.Terminal | undefined;

  constructor() { }

  public async runTests(taskPath: string): Promise<TestResult> {
    const taskName = path.basename(taskPath);

    const testFiles = this.findTestFiles(taskPath);

    if (testFiles.length === 0) {
      vscode.window.showErrorMessage('No test files found');
      return {
        taskPath,
        taskName,
        success: false,
        message: 'No test files found'
      };
    }

    try {
      if (!this.terminal || this.terminal.exitStatus !== undefined) {
        this.terminal = vscode.window.createTerminal('CodeDrills Tests');
      }

      if (!this.terminal) {
        throw new Error('Failed to create terminal');
      }

      this.terminal.show();

      const isWindows = os.platform() === 'win32';
      const pythonCmd = getPythonCommand();
      const tempFile = getTempFilePath(taskPath);

      const clearCommand = isWindows ? 'cls' : 'clear';
      const cdCommand = isWindows ? `cd "${taskPath}" &&` : `cd "${taskPath}" &&`;

      const redirectionSyntax = isWindows ?
        `> "${tempFile}" 2>&1 && echo %ERRORLEVEL% > "${tempFile}.exit"` :
        `> "${tempFile}" 2>&1; echo $? > "${tempFile}.exit"`;

      this.terminal.sendText(clearCommand, true);

      this.terminal.sendText(`echo "Running tests for: ${taskName}"`, true);

      return new Promise<TestResult>((resolve) => {
        const testCommand = `${cdCommand} ${pythonCmd} -m pytest -v`;
        this.terminal?.sendText(testCommand); 

        const captureCommand = isWindows ?
          `${cdCommand} ${pythonCmd} -m pytest -v ${redirectionSyntax}` :
          `${cdCommand} ${pythonCmd} -m pytest -v ${redirectionSyntax}`;

        const hiddenTerminal = vscode.window.createTerminal({ name: 'Test Results Capture', isTransient: true });
        hiddenTerminal.sendText(captureCommand, true);

        setTimeout(() => {
          try {
            if (fs.existsSync(tempFile)) {
              const output = fs.readFileSync(tempFile, 'utf8');
              let exitCodeStr = fs.existsSync(`${tempFile}.exit`) ?
                fs.readFileSync(`${tempFile}.exit`, 'utf8').trim() : '1';
              exitCodeStr = exitCodeStr.replace(/[\r\n]+/g, '');
              const exitCode = parseInt(exitCodeStr, 10);

              let testsPassed = 0;
              let testsFailed = 0;

              const passedMatch = output.match(/(\d+) passed/);
              const failedMatch = output.match(/(\d+) failed/);

              if (passedMatch && passedMatch[1]) {
                testsPassed = parseInt(passedMatch[1], 10);
              }

              if (failedMatch && failedMatch[1]) {
                testsFailed = parseInt(failedMatch[1], 10);
              }

              const testsRun = testsPassed + testsFailed;

              try {
                fs.unlinkSync(tempFile);
                fs.unlinkSync(`${tempFile}.exit`);
              } catch (err) { }

              hiddenTerminal.dispose();

              resolve({
                taskPath,
                taskName,
                success: exitCode === 0 || output.includes(' PASSED') && !output.includes(' FAILED'),
                message: output,
                testsPassed,
                testsFailed,
                testsRun
              });
            } else {
              hiddenTerminal.dispose();
              resolve({
                taskPath,
                taskName,
                success: false,
                message: 'Error running tests: no output captured'
              });
            }
          } catch (error) {
            hiddenTerminal.dispose();
            resolve({
              taskPath,
              taskName,
              success: false,
              message: `Error processing test results: ${error}`
            });
          }
        }, 2000);
      });
    } catch (error: unknown) {
      let errorMessage: string;

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = 'Unknown error';
      }

      return {
        taskPath,
        taskName,
        success: false,
        message: `Error running tests: ${errorMessage}`
      };
    }
  }

  private findTestFiles(taskPath: string): string[] {
    const testFiles: string[] = [];

    try {
      const files = fs.readdirSync(taskPath);

      for (const file of files) {
        if (
          file.startsWith('test_') ||
          file.endsWith('_test.py') ||
          file.match(/^test.*\.py$/) ||
          file.match(/.*_test\.py$/)
        ) {
          testFiles.push(path.join(taskPath, file));
        }
      }

      const testsDir = path.join(taskPath, 'tests');
      if (fs.existsSync(testsDir) && fs.statSync(testsDir).isDirectory()) {
        const testDirFiles = fs.readdirSync(testsDir);
        for (const file of testDirFiles) {
          if (file.endsWith('.py')) {
            testFiles.push(path.join(testsDir, file));
          }
        }
      }
    } catch (error) {
      console.error(`Error finding test files: ${error}`);
    }

    return testFiles;
  }
}