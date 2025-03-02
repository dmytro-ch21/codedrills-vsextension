import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as proxyquire from 'proxyquire';
import { createMockModules } from '../mockModules';

suite('ReportGenerator Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockModules: any;
  let reportGenerator: any;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    mockModules = createMockModules(sandbox);
    
    const proxiedReportGenerator = proxyquire.noCallThru().load('../../reportGenerator', {
      'fs': mockModules.fs,
      'path': mockModules.path,
      'vscode': mockModules.vscode
    });
    
    reportGenerator = new proxiedReportGenerator.ReportGenerator(mockModules.vscode.Uri.file('/mock/extension'));
  });
  
  teardown(() => {
    sandbox.restore();
  });
  
  test('generateReport should create an HTML report file', async () => {
    mockModules.vscode.workspace.workspaceFolders = [{
      uri: { fsPath: '/mock/workspace' },
      name: 'mock',
      index: 0
    }];
    
    mockModules.fs.existsSync.returns(false);
    
    const mockTasks = [
      {
        name: 'task1',
        path: '/path/to/task1',
        status: { tested: true, passed: true, message: 'All tests passed' },
        description: 'Task 1 Description'
      },
      {
        name: 'task2',
        path: '/path/to/task2',
        status: { tested: true, passed: false, message: 'Some tests failed' },
        description: 'Task 2 Description'
      },
      {
        name: 'task3',
        path: '/path/to/task3',
        status: { tested: false, passed: false },
        description: 'Task 3 Description'
      }
    ];
    
    const reportPath = await reportGenerator.generateReport(mockTasks);
    
    assert.strictEqual(mockModules.fs.mkdirSync.calledOnce, true);
    assert.strictEqual(mockModules.fs.writeFileSync.calledOnce, true);
    
    const contentStr = mockModules.fs.writeFileSync.firstCall.args[1];
    assert.strictEqual(contentStr.includes('task1'), true);
    assert.strictEqual(contentStr.includes('task2'), true);
    assert.strictEqual(contentStr.includes('task3'), true);
  });
  
  test('generateReport should throw error if no workspace folder', async () => {
    mockModules.vscode.workspace.workspaceFolders = undefined;
    
    try {
      await reportGenerator.generateReport([]);
      assert.fail('Expected an error to be thrown');
    } catch (error) {
      assert.strictEqual((error as Error).message, 'No workspace folder open');
    }
  });
  
  test('generateHtmlContent should generate correct HTML structure', () => {
    const mockTasks = [
      {
        name: 'passed-task',
        path: '/path/to/passed',
        status: { tested: true, passed: true },
        description: 'Passed Task Description'
      },
      {
        name: 'failed-task',
        path: '/path/to/failed',
        status: { tested: true, passed: false },
        description: 'Failed Task Description'
      }
    ];
    
    const html = reportGenerator.generateHtmlContent(mockTasks);
    
    assert.strictEqual(html.includes('<html'), true);
    assert.strictEqual(html.includes('passed-task'), true);
    assert.strictEqual(html.includes('failed-task'), true);
  });
  
  test('generateTaskListHtml should handle empty lists', () => {
    const html = reportGenerator.generateTaskListHtml([], 'passed');
    assert.strictEqual(html, '<p>No tasks in this category.</p>');
  });
});