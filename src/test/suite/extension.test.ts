import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as proxyquire from 'proxyquire';
import { createMockExtensionContext } from '../mocks';
import { createMockModules } from '../mockModules';

suite('Extension Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockModules: any;
  let taskProvider: any;
  let testRunner: any;
  let reportGenerator: any;
  let taskTreeDataProvider: any;
  let extension: any;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    mockModules = createMockModules(sandbox);
    
    const mockContext = createMockExtensionContext(sandbox);
    
    const proxiedTaskProvider = proxyquire.noCallThru().load('../../taskProvider', {
      'fs': mockModules.fs,
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });
    
    const proxiedTestRunner = proxyquire.noCallThru().load('../../testRunner', {
      'fs': mockModules.fs,
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });
    
    const proxiedReportGenerator = proxyquire.noCallThru().load('../../reportGenerator', {
      'fs': mockModules.fs,
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });
    
    const proxiedTaskTreeDataProvider = proxyquire.noCallThru().load('../../taskTreeDataProvider', {
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });
    
    taskProvider = new proxiedTaskProvider.TaskProvider(mockContext);
    testRunner = new proxiedTestRunner.TestRunner();
    reportGenerator = new proxiedReportGenerator.ReportGenerator(mockContext.extensionUri);
    taskTreeDataProvider = new proxiedTaskTreeDataProvider.TaskTreeDataProvider(taskProvider);

    extension = proxyquire.noCallThru().load('../../extension', {
      './taskProvider': { TaskProvider: function() { return taskProvider; } },
      './testRunner': { TestRunner: function() { return testRunner; } },
      './reportGenerator': { ReportGenerator: function() { return reportGenerator; } },
      './taskTreeDataProvider': { TaskTreeDataProvider: function() { return taskTreeDataProvider; } },
      'vscode': mockModules.vscode,
      'fs': mockModules.fs,
      'path': mockModules.path
    });
    
    // Set global state for testing
    extension.globalStateForTesting = { disposables: [] };
  });
  
  teardown(() => {
    sandbox.restore();
  });
  
  test('Extension should activate', async () => {
    mockModules.fs.readdirSync.callsFake(dirPath => {
      if (dirPath === '/test/workspace') {
        return ['exercise_1', 'exercise_2'];
      } else if (dirPath.includes('exercise_1') || dirPath.includes('exercise_2')) {
        return ['README.md', 'solution.py'];
      }
      return [];
    });

    mockModules.fs.readFileSync.returns('# Exercise Title\nDescription goes here');
    
    const mockContext = createMockExtensionContext(sandbox);
    
    await extension.activate(mockContext);
    
    assert.ok(
      mockModules.vscode.commands.executeCommand.calledWith(
        'setContext', 'codeDrills.active', true
      )
    );
  });
  
  test('TaskProvider should scan directories for tasks', async () => {
    mockModules.vscode.workspace.workspaceFolders = [{ 
      uri: { fsPath: '/test/workspace' }, 
      name: 'Test', 
      index: 0 
    }];
    
    mockModules.fs.readdirSync.withArgs('/test/workspace').returns(['exercise_1', 'exercise_2', '.git']);
    mockModules.fs.readdirSync.withArgs('/test/workspace/exercise_1').returns(['README.md', 'solution.py']);
    mockModules.fs.readdirSync.withArgs('/test/workspace/exercise_2').returns(['README.md', 'solution.py']);
    
    mockModules.fs.statSync.returns({ isDirectory: () => true, isFile: () => false });
    mockModules.fs.readFileSync.returns('# Exercise\nDescription');
    mockModules.fs.existsSync.returns(true);
    
    taskProvider.refresh();
    
    const tasks = taskProvider.getTasks();
    assert.strictEqual(tasks.length, 2);
    assert.strictEqual(mockModules.fs.readdirSync.called, true);
  });
    
  test('Extension should deactivate properly', async () => {
    const mockTerminal = { 
      name: 'CodeDrills Tests', 
      dispose: sandbox.stub() 
    };
    
    mockModules.vscode.window.terminals = [mockTerminal];
    
    extension.deactivate();
    
    assert.strictEqual(
      mockModules.vscode.commands.executeCommand.calledWith('setContext', 'codeDrills.active', false), 
      true
    );
  });

  test('Task statuses should persist between extension sessions', async () => {
    mockModules.vscode.workspace.workspaceFolders = [{ 
      uri: { fsPath: '/test/workspace' }, 
      name: 'Test', 
      index: 0 
    }];
    
    mockModules.fs.readdirSync.withArgs('/test/workspace').returns(['exercise_1']);
    mockModules.fs.readdirSync.withArgs('/test/workspace/exercise_1').returns(['README.md', 'solution.py']);
    mockModules.fs.statSync.returns({ isDirectory: () => true, isFile: () => false });
    mockModules.fs.readFileSync.returns('# Exercise\nDescription');
    mockModules.fs.existsSync.returns(true);
    
    const mockStorage: Record<string, any> = {};
    
    const mockContext = createMockExtensionContext(sandbox, {
      workspaceState: {
        get: (key: string) => mockStorage[key],
        update: (key: string, value: any) => { 
          mockStorage[key] = value; 
          return Promise.resolve();
        },
        keys: () => Object.keys(mockStorage)
      }
    });
    
    const tasksModule = proxyquire.noCallThru().load('../../taskProvider', {
      'fs': mockModules.fs,
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });
    
    const firstSessionProvider = new tasksModule.TaskProvider(mockContext);
    firstSessionProvider.refresh();
    
    const tasks = firstSessionProvider.getTasks();
    assert.strictEqual(tasks.length, 1, 'Should find one exercise');
    
    const result = { 
      success: true, 
      message: 'All tests passed',
      taskName: tasks[0].name
    };
    
    await firstSessionProvider.updateTaskStatus(tasks[0].path, result);
    
    const secondSessionProvider = new tasksModule.TaskProvider(mockContext);
    secondSessionProvider.refresh();
    
    const refreshedTasks = secondSessionProvider.getTasks();
    assert.strictEqual(refreshedTasks.length, 1, 'Should still find one exercise');
    assert.strictEqual(refreshedTasks[0].status.tested, true, 'Task should be marked as tested');
    assert.strictEqual(refreshedTasks[0].status.passed, true, 'Task should be marked as passed');
  });

  test('Extension should properly dispose all resources on deactivation', async () => {
    const mockDisposable1 = { dispose: sandbox.stub() };
    const mockDisposable2 = { dispose: sandbox.stub() };
    
    const mockTerminal = { 
      name: 'CodeDrills Tests', 
      dispose: sandbox.stub() 
    };
    const otherTerminal = { 
      name: 'Other Terminal', 
      dispose: sandbox.stub() 
    };
    
    mockModules.vscode.window.terminals = [mockTerminal, otherTerminal];
    
    extension.globalStateForTesting = { 
      disposables: [mockDisposable1, mockDisposable2] 
    };
    
    extension.deactivate();
    
    assert.strictEqual(
      mockModules.vscode.commands.executeCommand.calledWith('setContext', 'codeDrills.active', false),
      true,
      'Extension should set context to inactive'
    );
    
    assert.strictEqual(
      mockTerminal.dispose.calledOnce,
      true,
      'CodeDrills test terminal should be disposed'
    );
    
    assert.strictEqual(
      otherTerminal.dispose.called,
      false,
      'Other terminals should not be disposed'
    );
    
    assert.strictEqual(
      extension.globalStateForTesting,
      undefined, 
      'Global state should be cleared'
    );
  });

  test('Reports should be persisted to filesystem', async () => {
    mockModules.vscode.workspace.workspaceFolders = [{ 
      uri: { fsPath: '/test/workspace' }, 
      name: 'Test', 
      index: 0 
    }];
    
    const mockTasks = [
      {
        name: 'task1',
        path: '/path/to/task1',
        status: { tested: true, passed: true },
        description: 'Task 1'
      },
      {
        name: 'task2',
        path: '/path/to/task2',
        status: { tested: true, passed: false },
        description: 'Task 2'
      }
    ];
    
    sandbox.stub(taskProvider, 'getTasks').returns(mockTasks);
    
    mockModules.fs.existsSync.withArgs('/test/workspace/reports').returns(false);
    
    const reportPath = await reportGenerator.generateReport(mockTasks);
    
    assert.strictEqual(
      mockModules.fs.mkdirSync.calledWith('/test/workspace/reports', { recursive: true }),
      true,
      'Should create reports directory'
    );
    
    assert.strictEqual(
      mockModules.fs.writeFileSync.calledOnce,
      true,
      'Should write report file'
    );
    
    const reportContent = mockModules.fs.writeFileSync.firstCall.args[1];
    assert.strictEqual(
      reportContent.includes('task1') && reportContent.includes('task2'),
      true,
      'Report should include task information'
    );
  });
});