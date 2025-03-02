import * as sinon from 'sinon';
import * as path from 'path';

export function createMockModules(sandbox: sinon.SinonSandbox) {
  const fsMock = {
    readdirSync: sandbox.stub().returns([]),
    readFileSync: sandbox.stub().returns('# Test'),
    existsSync: sandbox.stub().returns(true),
    statSync: sandbox.stub().returns({ 
      isDirectory: () => true, 
      isFile: () => false 
    }),
    writeFileSync: sandbox.stub(),
    mkdirSync: sandbox.stub(),
    unlinkSync: sandbox.stub()
  };

  const vscodeMock = {
    window: {
      showInformationMessage: sandbox.stub(),
      showErrorMessage: sandbox.stub(),
      createTerminal: sandbox.stub().returns({
        show: sandbox.stub(),
        sendText: sandbox.stub(),
        dispose: sandbox.stub()
      })
    },
    workspace: {
      workspaceFolders: [{
        uri: { fsPath: '/test/workspace' },
        name: 'Test Workspace',
        index: 0
      }]
    },
    commands: {
      executeCommand: sandbox.stub().resolves(),
      registerCommand: sandbox.stub().returns({})
    },
    Uri: {
      file: sandbox.stub().callsFake(p => ({ fsPath: p }))
    }
  };

  return { fs: fsMock, vscode: vscodeMock, path };
}