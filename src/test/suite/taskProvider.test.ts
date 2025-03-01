import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TaskProvider, Task } from '../../taskProvider';
import { createMockStats, mockDirents } from '../testHelpers';

suite('TaskProvider Tests', () => {
  let taskProvider: TaskProvider;
  let sandbox: sinon.SinonSandbox;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    taskProvider = new TaskProvider();
  });
  
  teardown(() => {
    sandbox.restore();
  });
  
  test('getTasks should return empty array initially', () => {
    assert.deepStrictEqual(taskProvider.getTasks(), []);
  });
  
  test('refresh should scan directories for README files', () => {
    const readdirStub = sandbox.stub(fs, 'readdirSync');
    const readFileStub = sandbox.stub(fs, 'readFileSync');
    const statStub = sandbox.stub(fs, 'statSync');    

    const mockWorkspaceFolder = { uri: { fsPath: '/mock/path' }, name: 'mock', index: 0 };

    sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);
    
    readdirStub.withArgs('/mock/path').returns(mockDirents(['exercise1', 'exercise2']));
    readdirStub.withArgs('/mock/path/exercise1').returns(mockDirents(['README.md', 'solution.py', 'test_solution.py']));
    readdirStub.withArgs('/mock/path/exercise2').returns(mockDirents(['README.md', 'solution.py', '__pycache__']));
    
    statStub.callsFake((pathParam: fs.PathLike): fs.Stats => {
      const pathStr = String(pathParam);
      return createMockStats(
        pathStr.endsWith('exercise1') || 
        pathStr.endsWith('exercise2') || 
        pathStr.endsWith('__pycache__')
      );
    });
    
    readFileStub.withArgs(path.join('/mock/path/exercise1', 'README.md')).returns('# Exercise 1\nDescription for exercise 1');
    readFileStub.withArgs(path.join('/mock/path/exercise2', 'README.md')).returns('# Exercise 2\nDescription for exercise 2');
    
    taskProvider.refresh();
    
    const tasks = taskProvider.getTasks();
    assert.strictEqual(tasks.length, 2);
    assert.strictEqual(tasks[0].name, 'exercise1');
    assert.strictEqual(tasks[1].name, 'exercise2');
    
    assert.deepStrictEqual(tasks[0].files, ['README.md', 'solution.py']);
    assert.deepStrictEqual(tasks[1].files, ['README.md', 'solution.py']);
  });
  
  test('getTaskByPath should return the correct task', () => {
    const mockTasks = [
      {
        name: 'task1',
        path: '/path/to/task1',
        files: ['README.md', 'solution.py'],
        status: { tested: false, passed: false, message: undefined },
        description: 'Task 1'
      },
      {
        name: 'task2',
        path: '/path/to/task2',
        files: ['README.md', 'solution.py'],
        status: { tested: false, passed: false },
        description: 'Task 2'
      }
    ];
    
    (taskProvider as any).tasks = mockTasks;
    
    const task = taskProvider.getTaskByPath('/path/to/task1');
    assert.strictEqual(task?.name, 'task1');
    
    const nonExistentTask = taskProvider.getTaskByPath('/path/to/nonexistent');
    assert.strictEqual(nonExistentTask, undefined);
  });
  
  test('updateTaskStatus should update the task status', () => {
    const mockTasks = [
      {
        name: 'task1',
        path: '/path/to/task1',
        files: ['README.md', 'solution.py'],
        status: { tested: false, passed: false, message: undefined },
        description: 'Task 1'
      }
    ];
    
    (taskProvider as any).tasks = mockTasks;
    
    const emitSpy = sandbox.spy(taskProvider['_onDidChangeTask'], 'fire');
    
    taskProvider.updateTaskStatus('/path/to/task1', {
      success: true,
      taskName: 'task1',
      message: 'Tests passed'
    });
    
    assert.strictEqual(mockTasks[0].status.tested, true);
    assert.strictEqual(mockTasks[0].status.passed, true);
    assert.strictEqual(mockTasks[0].status.message, 'Tests passed');
    
    assert.strictEqual(emitSpy.calledOnce, true);
    assert.strictEqual(emitSpy.firstCall.args[0], mockTasks[0]);
  });
  
  test('extractDescription should get description from README content', () => {
    const content1 = '# Exercise Title\nThis is a description.';
    const content2 = 'No heading here\nJust content.';
    const content3 = '';
    
    const description1 = (taskProvider as any).extractDescription(content1);
    const description2 = (taskProvider as any).extractDescription(content2);
    const description3 = (taskProvider as any).extractDescription(content3);
    
    assert.strictEqual(description1, 'Exercise Title');
    assert.strictEqual(description2, 'No heading here');
    assert.strictEqual(description3, 'No description available');
  });
  
  test('isTestFile should identify test files correctly', () => {
    const testFiles = [
      'test_solution.py',
      'solution_test.py',
      'test.component.js',
      'component.test.js',
      'test.service.ts',
      'service.test.ts'
    ];
    
    const nonTestFiles = [
      'solution.py',
      'index.js',
      'component.js',
      'service.ts',
      'README.md'
    ];
    
    for (const file of testFiles) {
      assert.strictEqual((taskProvider as any).isTestFile(file), true, `${file} should be identified as a test file`);
    }
    
    for (const file of nonTestFiles) {
      assert.strictEqual((taskProvider as any).isTestFile(file), false, `${file} should not be identified as a test file`);
    }
  });
});