import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as proxyquire from 'proxyquire';
import { createMockModules } from '../mockModules';
import { createMockExtensionContext } from '../mocks';

suite('TaskProvider Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockModules: any;
  let taskProvider: any;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockModules = createMockModules(sandbox);

    const mockContext = createMockExtensionContext(sandbox);

    const proxiedTaskProvider = proxyquire.noCallThru().load('../../taskProvider', {
      'fs': mockModules.fs,
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });

    taskProvider = new proxiedTaskProvider.TaskProvider(mockContext);
  });

  teardown(() => {
    sandbox.restore();
  });

  test('getTasks should return empty array initially', () => {
    assert.deepStrictEqual(taskProvider.getTasks(), []);
  });

  test('refresh should scan directories for README files', () => {
    const mockWorkspaceFolder = { uri: { fsPath: '/mock/path' }, name: 'mock', index: 0 };
    mockModules.vscode.workspace.workspaceFolders = [mockWorkspaceFolder];

    mockModules.fs.readdirSync.withArgs('/mock/path').returns(['exercise1', 'exercise2']);
    mockModules.fs.readdirSync.withArgs('/mock/path/exercise1').returns(['README.md', 'solution.py']);
    mockModules.fs.readdirSync.withArgs('/mock/path/exercise2').returns(['README.md', 'solution.py']);

    mockModules.fs.statSync.callsFake((pathParam) => {
      const pathStr = String(pathParam);
      return {
        isDirectory: () => pathStr.endsWith('exercise1') || pathStr.endsWith('exercise2'),
        isFile: () => !pathStr.endsWith('exercise1') && !pathStr.endsWith('exercise2')
      };
    });

    mockModules.fs.readFileSync.returns('# Exercise\nDescription');
    mockModules.fs.existsSync.returns(true);

    taskProvider.refresh();

    const tasks = taskProvider.getTasks();
    assert.strictEqual(tasks.length, 2);
  });

  test('getTaskByPath should return the correct task', () => {
    const mockTasks = [
      {
        name: 'task1',
        path: '/path/to/task1',
        status: { tested: false, passed: false }
      },
      {
        name: 'task2',
        path: '/path/to/task2',
        status: { tested: false, passed: false }
      }
    ];

    taskProvider.tasks = mockTasks;

    const task = taskProvider.getTaskByPath('/path/to/task1');
    assert.strictEqual(task?.name, 'task1');

    const nonExistentTask = taskProvider.getTaskByPath('/path/to/nonexistent');
    assert.strictEqual(nonExistentTask, undefined);
  });
});