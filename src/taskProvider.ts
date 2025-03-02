import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface Task {
  name: string;
  path: string;
  files?: string[];
  status: {
    tested: boolean;
    passed: boolean;
    message?: string;
  };
  description: string;
}

export interface TaskStatus {
  tested: boolean;
  passed: boolean;
  message?: string;
}

export interface TestResult {
  success: boolean;
  taskName: string;
  message?: string;
}

export class TaskProvider {
  private tasks: Task[] = [];
  private _onDidChangeTask = new vscode.EventEmitter<Task>();
  readonly onDidChangeTask = this._onDidChangeTask.event;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public refresh(): void {
    this.tasks = [];

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.log('No workspace folders found.');
      return;
    }

    console.log(`Scanning ${workspaceFolders.length} workspace folders for exercises...`);

    for (const folder of workspaceFolders) {
      this.scanDirectory(folder.uri.fsPath);
    }

    this.loadTaskStatuses();

    console.log(`Found ${this.tasks.length} exercises.`);
    this.tasks.sort((a, b) => a.name.localeCompare(b.name));
  }

  private scanDirectory(directoryPath: string): void {
    try {
      const files = fs.readdirSync(directoryPath);

      const isWorkspaceRoot = vscode.workspace.workspaceFolders?.some(folder => 
        folder.uri.fsPath === directoryPath
      ) ?? false;

      if (files.includes('README.md') && !isWorkspaceRoot) {
        const readmePath = path.join(directoryPath, 'README.md');
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        const taskName = path.basename(directoryPath);

        const visibleFiles = files.filter(file => {
          const filePath = path.join(directoryPath, file);
          const isDirectory = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();

          if (isDirectory && (
            file === '__pycache__' ||
            file === '.vscode' ||
            file === 'node_modules' ||
            file === '.pytest_cache' ||
            file === '.git'
          )) {
            return false;
          }

          return !this.isTestFile(file) && !file.startsWith('.');
        });

        this.tasks.push({
          name: taskName,
          path: directoryPath,
          files: visibleFiles,
          status: {
            tested: false,
            passed: false
          },
          description: this.extractDescription(readmeContent)
        });
      }

      for (const file of files) {
        if (file === '__pycache__' ||
          file === '.vscode' ||
          file === 'node_modules' ||
          file === '.pytest_cache' ||
          file === '.git' ||
          file.startsWith('.')) {
          continue;
        }

        const filePath = path.join(directoryPath, file);
        if (fs.statSync(filePath).isDirectory()) {
          this.scanDirectory(filePath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${directoryPath}:`, error);
    }
  }

  private extractDescription(content: string): string {
    const lines = content.split('\n');
    let description = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('# ')) {
        description = trimmedLine.substring(2);
        break;
      } else if (trimmedLine.length > 0 && !description) {
        description = trimmedLine;
      }
    }

    return description || 'No description available';
  }

  public getTasks(): Task[] {
    return this.tasks;
  }

  public getTaskByPath(taskPath: string): Task | undefined {
    return this.tasks.find(task => task.path === taskPath);
  }

  public getNextTask(currentTask: Task): Task | undefined {
    const currentIndex = this.tasks.findIndex(task => task.path === currentTask.path);
    if (currentIndex >= 0 && currentIndex < this.tasks.length - 1) {
      return this.tasks[currentIndex + 1];
    }
    return undefined;
  }

  public getPreviousTask(currentTask: Task): Task | undefined {
    const currentIndex = this.tasks.findIndex(task => task.path === currentTask.path);
    if (currentIndex > 0) {
      return this.tasks[currentIndex - 1];
    }
    return undefined;
  }

  public getCurrentTaskFromEditor(): Task | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return undefined;
    }

    const filePath = activeEditor.document.uri.fsPath;
    if (!filePath.endsWith('README.md')) {
      return undefined;
    }

    const directoryPath = path.dirname(filePath);
    return this.getTaskByPath(directoryPath);
  }

  private saveTaskStatuses(): void {
    const statusMap: Record<string, TaskStatus> = {};
    
    for (const task of this.tasks) {
      statusMap[task.path] = task.status;
    }
    
    this.context.workspaceState.update('codeDrills.taskStatuses', statusMap);
  }

  private loadTaskStatuses(): void {
    const statusMap = this.context.workspaceState.get<Record<string, TaskStatus>>('codeDrills.taskStatuses') || {};
    
    for (const task of this.tasks) {
      if (statusMap[task.path]) {
        task.status = statusMap[task.path];
      }
    }
  }

  public updateTaskStatus(taskPath: string, result: TestResult): void {
    const task = this.getTaskByPath(taskPath);
    if (task) {
      task.status = {
        tested: true,
        passed: result.success,
        message: result.message
      };

      this.saveTaskStatuses();
      this._onDidChangeTask.fire(task);
    }
  }

  private isTestFile(filename: string): boolean {
    const testPatterns = [
      /^test_.+\.py$/,
      /.+_test\.py$/,
      /^test\..*\.js$/,
      /.*\.test\.js$/,
      /^test\..*\.ts$/,
      /.*\.test\.ts$/
    ];

    return testPatterns.some(pattern => pattern.test(filename));
  }

  public clearTaskStatuses(): void {
    for (const task of this.tasks) {
      task.status = {
        tested: false,
        passed: false,
        message: undefined
      };
    }
    
    this.saveTaskStatuses();
    
    this.tasks.forEach(task => this._onDidChangeTask.fire(task));
  }
}