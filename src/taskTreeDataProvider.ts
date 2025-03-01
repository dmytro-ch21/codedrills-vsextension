import * as vscode from 'vscode';
import * as path from 'path';
import { Task, TaskProvider } from './taskProvider';

export class TaskTreeItem extends vscode.TreeItem {
    public readonly task: Task;
    public path: string;

    constructor(
        task: Task,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(task.name, collapsibleState);

        this.task = task;
        this.path = task.path;
        this.tooltip = task.description;
        this.description = this.getStatusText();
        this.contextValue = 'exercise';

        this.iconPath = this.getIconPath();

        this.command = {
            command: 'codeDrills.openExercise',
            title: 'Open Exercise',
            arguments: [task.path]
        };
    }

    private getStatusText(): string {
        if (!this.task.status.tested) {
            return 'Not tested';
        }
        return this.task.status.passed ? 'Passed' : 'Failed';
    }

    private getIconPath(): { light: vscode.Uri; dark: vscode.Uri } | undefined {
        const extensionPath = path.join(__filename, '..', '..');

        if (!this.task.status.tested) {
            return {
                light: vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'light', 'untested.svg')),
                dark: vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'dark', 'untested.svg'))
            };
        }

        if (this.task.status.passed) {
            return {
                light: vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'light', 'passed.svg')),
                dark: vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'dark', 'passed.svg'))
            };
        }

        return {
            light: vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'light', 'failed.svg')),
            dark: vscode.Uri.file(path.join(extensionPath, 'media', 'icons', 'dark', 'failed.svg'))
        };
    }
}

export class TaskTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined> = new vscode.EventEmitter<TaskTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined> = this._onDidChangeTreeData.event;

    constructor(private taskProvider: TaskProvider) {
        this.taskProvider.onDidChangeTask(() => {
            this.refresh();
        });
    }

    refresh(): void {
        console.log('Refreshing exercise tree view...');
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        const tasks = this.taskProvider.getTasks();
        return Promise.resolve(
            tasks.map(task => new TaskTreeItem(task, vscode.TreeItemCollapsibleState.None))
        );
    }
}