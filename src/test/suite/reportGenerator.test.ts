import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { ReportGenerator } from '../../reportGenerator';

suite('ReportGenerator Tests', () => {
  let reportGenerator: ReportGenerator;
  let sandbox: sinon.SinonSandbox;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    const extensionUri = vscode.Uri.file('/mock/extension');
    reportGenerator = new ReportGenerator(extensionUri);
  });
  
  teardown(() => {
    sandbox.restore();
  });
  
  test('generateReport should create an HTML report file', async () => {
    const mockWorkspaceFolder = { uri: { fsPath: '/mock/workspace' }, name: 'mock', index: 0 };
    sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);
    
    const existsStub = sandbox.stub(fs, 'existsSync').returns(false);
    const mkdirStub = sandbox.stub(fs, 'mkdirSync');
    const writeFileStub = sandbox.stub(fs, 'writeFileSync');
    
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
    
    assert.strictEqual(mkdirStub.calledOnce, true);
    assert.strictEqual(mkdirStub.firstCall.args[0], '/mock/workspace/reports');
    
    const firstArg = String(writeFileStub.firstCall.args[0]);
    assert.strictEqual(firstArg.startsWith('/mock/workspace/reports/task-report-'), true);
    
    const contentStr = String(writeFileStub.firstCall.args[1]);
    
    assert.strictEqual(contentStr.includes('task1'), true);
    assert.strictEqual(contentStr.includes('task2'), true);
    assert.strictEqual(contentStr.includes('task3'), true);
    assert.strictEqual(contentStr.includes('Task 1 Description'), true);
    assert.strictEqual(contentStr.includes('All tests passed'), true);
    assert.strictEqual(contentStr.includes('Some tests failed'), true);
    
    assert.strictEqual(contentStr.includes('1 passed'), true);
    assert.strictEqual(contentStr.includes('1 failed'), true);
    assert.strictEqual(contentStr.includes('1 untested'), true);
  });
  
  test('generateReport should throw error if no workspace folder', async () => {
    sandbox.stub(vscode.workspace, 'workspaceFolders').value(undefined);
    
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
    
    const html = (reportGenerator as any).generateHtmlContent(mockTasks);
    
    assert.strictEqual(html.includes('<html'), true);
    assert.strictEqual(html.includes('<head>'), true);
    assert.strictEqual(html.includes('<body>'), true);
    assert.strictEqual(html.includes('CodeDrills Practice Report'), true);
    assert.strictEqual(html.includes('Passed Exercises'), true);
    assert.strictEqual(html.includes('Failed Exercises'), true);
    assert.strictEqual(html.includes('Untested Exercises'), true);
    
    assert.strictEqual(html.includes('passed-task'), true);
    assert.strictEqual(html.includes('failed-task'), true);
    assert.strictEqual(html.includes('Passed Task Description'), true);
    assert.strictEqual(html.includes('Failed Task Description'), true);
    
    assert.strictEqual(html.includes('50%'), true);
  });
  
  test('generateTaskListHtml should handle empty lists', () => {
    const html = (reportGenerator as any).generateTaskListHtml([], 'passed');
    assert.strictEqual(html, '<p>No tasks in this category.</p>');
  });
});