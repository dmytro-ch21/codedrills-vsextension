import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TestRunner } from '../../testRunner';
import { createMockStats, mockDirents } from '../testHelpers';

suite('TestRunner Tests', () => {
  let testRunner: TestRunner;
  let sandbox: sinon.SinonSandbox;
  let terminalStub: any;
  
  setup(() => {
    sandbox = sinon.createSandbox();
    
    terminalStub = {
      show: sandbox.stub(),
      sendText: sandbox.stub(),
      dispose: sandbox.stub(),
      exitStatus: undefined
    };
    
    sandbox.stub(vscode.window, 'createTerminal').returns(terminalStub);
    
    testRunner = new TestRunner();
  });
  
  teardown(() => {
    sandbox.restore();
  });
  
  test('findTestFiles should find Python test files', async () => {
    const readdirStub = sandbox.stub(fs, 'readdirSync');
    const existsStub = sandbox.stub(fs, 'existsSync');
    const statStub = sandbox.stub(fs, 'statSync');
    
    const taskPath = '/mock/task';
    const testsDir = path.join(taskPath, 'tests');
    
    readdirStub.withArgs(taskPath).returns(mockDirents(['solution.py', 'test_solution.py', 'helper.py', 'tests']));
    readdirStub.withArgs(testsDir).returns(mockDirents(['test_helper.py']));
    
    existsStub.withArgs(testsDir).returns(true);
    statStub.withArgs(testsDir).returns(createMockStats(true));
    
    const testFiles = (testRunner as any).findTestFiles(taskPath);
    
    assert.strictEqual(testFiles.length, 2);
    assert.strictEqual(testFiles[0], path.join(taskPath, 'test_solution.py'));
    assert.strictEqual(testFiles[1], path.join(testsDir, 'test_helper.py'));
  });
  
  test('runTests should handle no test files found', async () => {
    sandbox.stub(testRunner as any, 'findTestFiles').returns([]);
    
    const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
    
    const result = await testRunner.runTests('/mock/task');
    
    assert.strictEqual(showErrorStub.calledOnce, true);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.message, 'No test files found');
  });
  
  test('runTests should execute tests and return results', async () => {
    const taskPath = '/mock/task';
    
    sandbox.stub(testRunner as any, 'findTestFiles').returns([path.join(taskPath, 'test_solution.py')]);
    
    const existsStub = sandbox.stub(fs, 'existsSync');
    const readFileStub = sandbox.stub(fs, 'readFileSync');
    const unlinkStub = sandbox.stub(fs, 'unlinkSync');
    
    const tempFile = path.join(taskPath, '.test_results.txt');
    const exitCodeFile = `${tempFile}.exit`;
    
    existsStub.withArgs(tempFile).returns(true);
    existsStub.withArgs(exitCodeFile).returns(true);
    
    readFileStub.withArgs(tempFile).returns(
      '============================= test session starts ==============================\n' +
      'platform darwin -- Python 3.8.0, pytest-5.3.5\n' +
      'collecting ... collected 2 items\n\n' +
      'test_solution.py::test_function PASSED\n' +
      'test_solution.py::test_edge_case PASSED\n\n' +
      '========================== 2 passed in 0.05s ==========================='
    );
    readFileStub.withArgs(exitCodeFile).returns('0');
    
    const originalSetTimeout = global.setTimeout;
    const mockSetTimeout = (fn: any, _timeout?: number, ..._args: any[]) => {
      if (typeof fn === 'function') fn();
      return {} as NodeJS.Timeout;
    };
    mockSetTimeout.__promisify__ = originalSetTimeout.__promisify__;
    global.setTimeout = mockSetTimeout as any;
    
    const result = await testRunner.runTests(taskPath);
    
    global.setTimeout = originalSetTimeout;
    
    assert.strictEqual(terminalStub.show.calledOnce, true);
    assert.strictEqual(terminalStub.sendText.called, true);
    
    assert.strictEqual(terminalStub.sendText.firstCall.args[0], 'clear');
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.testsPassed, 2);
    assert.strictEqual(result.testsFailed, 0);
    assert.strictEqual(result.testsRun, 2);
    
    assert.strictEqual(unlinkStub.calledWith(tempFile), true);
    assert.strictEqual(unlinkStub.calledWith(exitCodeFile), true);
  });
  
  test('runTests should handle failed tests', async () => {
    const taskPath = '/mock/task';
    
    sandbox.stub(testRunner as any, 'findTestFiles').returns([path.join(taskPath, 'test_solution.py')]);
    
    const existsStub = sandbox.stub(fs, 'existsSync');
    const readFileStub = sandbox.stub(fs, 'readFileSync');
    
    const tempFile = path.join(taskPath, '.test_results.txt');
    const exitCodeFile = `${tempFile}.exit`;
    
    existsStub.withArgs(tempFile).returns(true);
    existsStub.withArgs(exitCodeFile).returns(true);
    
    readFileStub.withArgs(tempFile).returns(
      '============================= test session starts ==============================\n' +
      'platform darwin -- Python 3.8.0, pytest-5.3.5\n' +
      'collecting ... collected 2 items\n\n' +
      'test_solution.py::test_function PASSED\n' +
      'test_solution.py::test_edge_case FAILED\n\n' +
      '========================== 1 passed, 1 failed in 0.05s ==========================='
    );
    readFileStub.withArgs(exitCodeFile).returns('1');
    
    const originalSetTimeout = global.setTimeout;
    const mockSetTimeout = (fn: any, _timeout?: number, ..._args: any[]) => {
      if (typeof fn === 'function') fn();
      return {} as NodeJS.Timeout;
    };
    mockSetTimeout.__promisify__ = originalSetTimeout.__promisify__;
    global.setTimeout = mockSetTimeout as any;
    
    const result = await testRunner.runTests(taskPath);
    
    global.setTimeout = originalSetTimeout;
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.testsPassed, 1);
    assert.strictEqual(result.testsFailed, 1);
    assert.strictEqual(result.testsRun, 2);
  });
  
  test('runTests should handle errors during execution', async () => {
    const taskPath = '/mock/task';
    
    sandbox.stub(testRunner as any, 'findTestFiles').throws(new Error('Test error'));
    
    const result = await testRunner.runTests(taskPath);
    
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.message?.includes('Error running tests: Test error'), true);
  });
});