import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { TaskTreeDataProvider, TaskTreeItem } from '../../taskTreeDataProvider';
import { TaskProvider } from '../../taskProvider';

suite('TaskTreeDataProvider Tests', () => {
  let taskProvider: TaskProvider;
  let treeDataProvider: TaskTreeDataProvider;
  let sandbox: sinon.SinonSandbox;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    taskProvider = new TaskProvider();
    treeDataProvider = new TaskTreeDataProvider(taskProvider);
  });
  
  teardown(() => {
    sandbox.restore();
  });
  
  test('getChildren should return empty array when no tasks exist', async () => {
    sandbox.stub(taskProvider, 'getTasks').returns([]);
    
    const children = await treeDataProvider.getChildren();
    assert.strictEqual(children.length, 0);
  });
  
  test('getChildren should return TreeItems for all tasks', async () => {
    const mockTasks = [
      {
        name: 'task1',
        path: '/path/to/task1',
        status: { tested: false, passed: false },
        description: 'Task 1'
      },
      {
        name: 'task2',
        path: '/path/to/task2',
        status: { tested: true, passed: true },
        description: 'Task 2'
      },
      {
        name: 'task3',
        path: '/path/to/task3',
        status: { tested: true, passed: false },
        description: 'Task 3'
      }
    ];
    
    sandbox.stub(taskProvider, 'getTasks').returns(mockTasks);
    
    const children = await treeDataProvider.getChildren();
    
    assert.strictEqual(children.length, 3);
    assert.strictEqual(children[0].label, 'task1');
    assert.strictEqual(children[1].label, 'task2');
    assert.strictEqual(children[2].label, 'task3');
    
    assert.strictEqual(children[0].tooltip, 'Task 1');
    assert.strictEqual(children[1].tooltip, 'Task 2');
    assert.strictEqual(children[2].tooltip, 'Task 3');
    
    assert.strictEqual(children[0].description, 'Not tested');
    assert.strictEqual(children[1].description, 'Passed');
    assert.strictEqual(children[2].description, 'Failed');
    
    assert.strictEqual(children[0].command?.command, 'codeDrills.openExercise');
    assert.strictEqual(children[0].command?.arguments?.[0], '/path/to/task1');
  });
  
  test('getChildren with element should return empty array', async () => {
    const mockTreeItem = new TaskTreeItem({
      name: 'task1',
      path: '/path/to/task1',
      status: { tested: false, passed: false },
      description: 'Task 1'
    }, vscode.TreeItemCollapsibleState.None);
    
    const children = await treeDataProvider.getChildren(mockTreeItem);
    assert.strictEqual(children.length, 0);
  });
  
  test('getTreeItem should return the element unchanged', () => {
    const mockTreeItem = new TaskTreeItem({
      name: 'task1',
      path: '/path/to/task1',
      status: { tested: false, passed: false },
      description: 'Task 1'
    }, vscode.TreeItemCollapsibleState.None);
    
    const returnedItem = treeDataProvider.getTreeItem(mockTreeItem);
    assert.strictEqual(returnedItem, mockTreeItem);
  });
  
  test('refresh should fire the onDidChangeTreeData event', () => {
    const fireSpy = sandbox.spy(treeDataProvider['_onDidChangeTreeData'], 'fire');
    
    treeDataProvider.refresh();
    
    assert.strictEqual(fireSpy.calledOnce, true);
    assert.strictEqual(fireSpy.firstCall.args[0], undefined);
  });
  
  test('TaskTreeItem should have correct icon based on status', () => {
    const extensionPath = path.join(__filename, '..', '..');
    
    const untestedTask = new TaskTreeItem({
      name: 'untested',
      path: '/path/to/untested',
      status: { tested: false, passed: false },
      description: 'Untested task'
    }, vscode.TreeItemCollapsibleState.None);
    
    const passedTask = new TaskTreeItem({
      name: 'passed',
      path: '/path/to/passed',
      status: { tested: true, passed: true },
      description: 'Passed task'
    }, vscode.TreeItemCollapsibleState.None);
    
    const failedTask = new TaskTreeItem({
      name: 'failed',
      path: '/path/to/failed',
      status: { tested: true, passed: false },
      description: 'Failed task'
    }, vscode.TreeItemCollapsibleState.None);
    
    assert.strictEqual((untestedTask.iconPath as any)?.light?.toString().includes('untested.svg'), true);
    assert.strictEqual((passedTask.iconPath as any)?.light?.toString().includes('passed.svg'), true);
    assert.strictEqual((failedTask.iconPath as any)?.light?.toString().includes('failed.svg'), true);
  });
});