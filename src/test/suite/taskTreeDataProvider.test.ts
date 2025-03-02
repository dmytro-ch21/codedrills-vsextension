import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as proxyquire from 'proxyquire';
import { createMockModules } from '../mockModules';
import { createMockExtensionContext } from '../mocks';

suite('TaskTreeDataProvider Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockModules: any;
  let taskProvider: any;
  let treeDataProvider: any;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    mockModules = createMockModules(sandbox);
    
    const mockContext = createMockExtensionContext(sandbox);
    
    const proxiedTaskProvider = proxyquire.noCallThru().load('../../taskProvider', {
      'fs': mockModules.fs,
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });
    
    const proxiedTreeDataProvider = proxyquire.noCallThru().load('../../taskTreeDataProvider', {
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });
    
    taskProvider = new proxiedTaskProvider.TaskProvider(mockContext);
    treeDataProvider = new proxiedTreeDataProvider.TaskTreeDataProvider(taskProvider);
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
      }
    ];
    
    sandbox.stub(taskProvider, 'getTasks').returns(mockTasks);
    
    const children = await treeDataProvider.getChildren();
    
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0].label, 'task1');
    assert.strictEqual(children[1].label, 'task2');
  });
  
});