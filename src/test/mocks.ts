import * as sinon from 'sinon';
import * as fs from 'fs';
import { createMockStats, mockDirents } from './testHelpers';

export function createFsMock(sandbox: sinon.SinonSandbox) {
  return {
    readdirSync: sandbox.stub(),
    readFileSync: sandbox.stub(),
    statSync: sandbox.stub(),
    existsSync: sandbox.stub(),
    writeFileSync: sandbox.stub(),
    mkdirSync: sandbox.stub(),
    unlinkSync: sandbox.stub()
  };
}

export function createVscodeMock(sandbox: sinon.SinonSandbox) {
  const terminalStub = {
    show: sandbox.stub(),
    sendText: sandbox.stub(),
    dispose: sandbox.stub(),
    exitStatus: undefined
  };

  return {
    window: {
      showTextDocument: sandbox.stub().resolves({}),
      showErrorMessage: sandbox.stub(),
      showInformationMessage: sandbox.stub(),
      createTerminal: sandbox.stub().returns(terminalStub),
      withProgress: sandbox.stub().callsFake(async (_options, callback) => {
        return callback({}, {});
      })
    },
    workspace: {
      openTextDocument: sandbox.stub().resolves({}),
      workspaceFolders: [{
        uri: { fsPath: '/mock/workspace' },
        name: 'Mock Workspace',
        index: 0
      }]
    },
    commands: {
      executeCommand: sandbox.stub().resolves()
    },
    Uri: {
      file: sandbox.stub().callsFake(path => ({ fsPath: path }))
    }
  };
}