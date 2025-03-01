import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { TaskProvider } from '../../taskProvider';
import { TaskTreeDataProvider } from '../../taskTreeDataProvider';
import { TestRunner } from '../../testRunner';
import { ReportGenerator } from '../../reportGenerator';
import { createMockStats, mockDirents } from '../testHelpers';

suite('Extension Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let taskProvider: TaskProvider;
  let taskTreeDataProvider: TaskTreeDataProvider;
  let testRunner: TestRunner;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    taskProvider = new TaskProvider();
    taskTreeDataProvider = new TaskTreeDataProvider(taskProvider);
    testRunner = new TestRunner();
  });
  
  teardown(() => {
    sandbox.restore();
  });
  
  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('undefined_publisher.codedrills');
    assert.ok(extension);
    
    if (extension) {
      await extension.activate();
      assert.strictEqual(extension.isActive, true);
    }
  });
  
  test('TaskProvider should scan directories for tasks', () => {
    const readdirStub = sandbox.stub(fs, 'readdirSync');
    const statStub = sandbox.stub(fs, 'statSync');
    const readFileStub = sandbox.stub(fs, 'readFileSync');
    
    sandbox.stub(vscode.workspace, 'workspaceFolders').value([
      { uri: { fsPath: '/test/workspace' }, name: 'Test Workspace', index: 0 }
    ]);
    
    readdirStub.withArgs('/test/workspace').returns(mockDirents(['exercise_1', 'exercise_2', '.git']));
    readdirStub.withArgs('/test/workspace/exercise_1').returns(mockDirents(['README.md', 'solution.py', 'test_solution.py']));
    readdirStub.withArgs('/test/workspace/exercise_2').returns(mockDirents(['README.md', 'solution.py', 'test_solution.py']));

    statStub.returns(createMockStats(false));
    statStub.withArgs('/test/workspace/exercise_1').returns(createMockStats(true));
    statStub.withArgs('/test/workspace/exercise_2').returns(createMockStats(true));
    
    readFileStub.returns('# Exercise\nTest exercise description');
    
    taskProvider.refresh();
    
    const tasks = taskProvider.getTasks();
    assert.strictEqual(tasks.length, 2);
    assert.strictEqual(tasks[0].name, 'exercise_1');
    assert.strictEqual(tasks[1].name, 'exercise_2');
  });
  
  test('TaskTreeDataProvider should create tree items from tasks', async () => {
    const mockTasks = [
      {
        name: 'exercise_1',
        path: '/test/workspace/exercise_1',
        files: ['README.md', 'solution.py', 'test_solution.py'],
        status: { tested: false, passed: false },
        description: 'Test exercise 1'
      },
      {
        name: 'exercise_2',
        path: '/test/workspace/exercise_2',
        files: ['README.md', 'solution.py', 'test_solution.py'],
        status: { tested: true, passed: true },
        description: 'Test exercise 2'
      }
    ];
    
    sandbox.stub(taskProvider, 'getTasks').returns(mockTasks);
    
    const treeItems = await taskTreeDataProvider.getChildren();
    
    assert.strictEqual(treeItems.length, 2);
    
    assert.strictEqual(treeItems[0].label, 'exercise_1');
    assert.strictEqual(treeItems[1].label, 'exercise_2');
    
    assert.notStrictEqual(treeItems[0].iconPath, treeItems[1].iconPath);
  });
  
  test('TestRunner should run tests and return results', async () => {
    const mockTerminal = {
      show: sandbox.stub(),
      sendText: sandbox.stub(),
      dispose: sandbox.stub()
    };
    
    sandbox.stub(vscode.window, 'createTerminal').returns(mockTerminal as any);
    
    sandbox.stub(fs, 'readdirSync').returns(mockDirents(['test_solution.py']));
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'readFileSync')
      .onFirstCall().returns('=== 1 passed, 0 failed ===')
      .onSecondCall().returns('0'); // Exit code
    sandbox.stub(fs, 'unlinkSync').returns();
    
    const result = await testRunner.runTests('/test/exercise');
    
    assert.strictEqual(result.success, true);
    assert.ok(mockTerminal.show.called);
    assert.ok(mockTerminal.sendText.called);
  });
  
  test('Running tests on a task should update task status', async () => {
    const mockTask = {
      name: 'exercise_1',
      path: '/test/workspace/exercise_1',
      files: [],
      status: { tested: false, passed: false },
      description: ''
    };
    
    const mockResult = {
      taskPath: '/test/workspace/exercise_1',
      taskName: 'exercise_1',
      success: true,
      testsPassed: 1,
      testsFailed: 0,
      testsRun: 1
    };
    
    sandbox.stub(taskProvider, 'getTaskByPath').returns(mockTask);
    
    taskProvider.updateTaskStatus('/test/workspace/exercise_1', mockResult);
    
    assert.strictEqual(mockTask.status.tested, true);
    assert.strictEqual(mockTask.status.passed, true);
  });
  
  test('openExercise command should open files correctly', async () => {
    const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument');
    const openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
    
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'statSync').returns({
      isFile: () => true
    } as any);
    
    await vscode.commands.executeCommand('codeDrills.openExercise', '/test/exercise');
    
    assert.ok(openTextDocumentStub.called);
    assert.ok(showTextDocumentStub.called);
    assert.ok(executeCommandStub.calledWith('markdown.showPreviewToSide'));
  });
  
  test('nextExercise and previousExercise should navigate between tasks', async () => {
    const mockTasks = [
      { name: 'task1', path: '/test/task1', status: { tested: false, passed: false }, description: 'Task 1' },
      { name: 'task2', path: '/test/task2', status: { tested: false, passed: false }, description: 'Task 2' },
      { name: 'task3', path: '/test/task3', status: { tested: false, passed: false }, description: 'Task 3' }
    ];
    
    sandbox.stub(taskProvider, 'getTasks').returns(mockTasks as any);
    sandbox.stub(taskProvider, 'getNextTask')
      .withArgs(mockTasks[0]).returns(mockTasks[1])
      .withArgs(mockTasks[1]).returns(mockTasks[2])
      .withArgs(mockTasks[2]).returns(undefined);
      
    sandbox.stub(taskProvider, 'getPreviousTask')
      .withArgs(mockTasks[2]).returns(mockTasks[1])
      .withArgs(mockTasks[1]).returns(mockTasks[0])
      .withArgs(mockTasks[0]).returns(undefined);
    
    const getCurrentTaskStub = sandbox.stub(taskProvider, 'getCurrentTaskFromEditor');
    getCurrentTaskStub.onFirstCall().returns(mockTasks[0] as any);
    getCurrentTaskStub.onSecondCall().returns(mockTasks[2] as any);
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
    await vscode.commands.executeCommand('codeDrills.nextExercise');
    assert.ok(executeCommandStub.calledWith('codeDrills.openExercise', '/test/task2'));
    await vscode.commands.executeCommand('codeDrills.previousExercise');
    assert.ok(executeCommandStub.calledWith('codeDrills.openExercise', '/test/task1'));
  });
  
  test('Report generation should create a markdown report', async () => {
    const mockTasks = [
      {
        name: 'exercise_1',
        path: '/test/exercise_1',
        status: { tested: true, passed: true },
        description: 'Test exercise 1'
      },
      {
        name: 'exercise_2',
        path: '/test/exercise_2',
        status: { tested: true, passed: false },
        description: 'Test exercise 2'
      },
      {
        name: 'exercise_3',
        path: '/test/exercise_3',
        status: { tested: false, passed: false },
        description: 'Test exercise 3'
      }
    ];
    
    sandbox.stub(taskProvider, 'getTasks').returns(mockTasks as any);
    
    const reportGenerator = new ReportGenerator(vscode.Uri.file('/mock/extension'));
    
    await reportGenerator.generateReport(mockTasks);
    
    const mockDocument = {
      save: sandbox.stub().resolves(true)
    };
    
    sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDocument as any);
    sandbox.stub(vscode.window, 'showTextDocument').resolves();
    
    assert.ok(mockDocument.save.called);
  });
});