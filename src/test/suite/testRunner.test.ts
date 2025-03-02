import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as proxyquire from 'proxyquire';
import { createMockModules } from '../mockModules';

suite('TestRunner Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockModules: any;
  let testRunner: any;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    mockModules = createMockModules(sandbox);
    
    // Terminal mock
    const terminalMock = {
      show: sandbox.stub(),
      sendText: sandbox.stub(),
      dispose: sandbox.stub(),
      exitStatus: undefined
    };
    mockModules.vscode.window.createTerminal.returns(terminalMock);
    
    const proxiedTestRunner = proxyquire.noCallThru().load('../../testRunner', {
      'fs': mockModules.fs,
      'path': mockModules.path,
      'vscode': mockModules.vscode,
      'os': { platform: () => 'linux' }
    });
    
    testRunner = new proxiedTestRunner.TestRunner();
  });
  
  teardown(() => {
    sandbox.restore();
  });
  
  test('findTestFiles should find Python test files', async () => {
    const taskPath = '/mock/task';
    
    mockModules.fs.readdirSync.withArgs(taskPath).returns(['solution.py', 'test_solution.py', 'tests']);
    mockModules.fs.readdirSync.withArgs('/mock/task/tests').returns(['test_helper.py']);
    
    mockModules.fs.existsSync.callsFake(path => {
      return true; 
    });
    
    mockModules.fs.statSync.callsFake(path => {
      return {
        isDirectory: () => String(path).endsWith('/tests'),
        isFile: () => !String(path).endsWith('/tests')
      };
    });
    
    const testFiles = testRunner.findTestFiles(taskPath);
    
    assert.strictEqual(testFiles.length, 2);
    assert.strictEqual(testFiles.includes('/mock/task/test_solution.py'), true);
    assert.strictEqual(testFiles.includes('/mock/task/tests/test_helper.py'), true);
  });
  
  test('runTests should handle no test files found', async () => {
    sandbox.stub(testRunner, 'findTestFiles').returns([]);
    
    const result = await testRunner.runTests('/mock/task');
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.message, 'No test files found');
  });
  
});