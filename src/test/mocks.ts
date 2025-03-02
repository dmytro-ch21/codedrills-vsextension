import * as sinon from 'sinon';
import * as vscode from 'vscode';


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

export function createMockExtensionContext(
  sandbox: sinon.SinonSandbox,
  options?: {
    workspaceState?: {
      get: (key: string) => any;
      update: (key: string, value: any) => Thenable<void>;
      keys: () => string[];
    }
  }
): vscode.ExtensionContext {
  const mockStorage: Record<string, any> = {};
  const onDidChangeEvent = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();

  return {
    subscriptions: [],
    extensionPath: '/mock/extension',
    extensionUri: { fsPath: '/mock/extension' } as any,
    storagePath: '/mock/storage', 
    globalStoragePath: '/mock/globalStorage', 
    logPath: '/mock/log',
    extension: {} as vscode.Extension<any>,
    languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
    globalState: {
      get: (key: string) => mockStorage[key],
      update: (key: string, value: any) => {
        mockStorage[key] = value;
        return Promise.resolve();
      },
      setKeysForSync: sandbox.stub(),
      keys: () => Object.keys(mockStorage)
    },
    workspaceState: options?.workspaceState ?? {
      get: (key: string) => mockStorage[key],
      update: (key: string, value: any) => {
        mockStorage[key] = value;
        return Promise.resolve();
      },
      keys: () => Object.keys(mockStorage)
    },
    secrets: {
      get: sandbox.stub().resolves(''),
      store: sandbox.stub().resolves(),
      delete: sandbox.stub().resolves(),
      onDidChange: onDidChangeEvent.event
    },
    storageUri: { fsPath: '/mock/storage' } as any,
    globalStorageUri: { fsPath: '/mock/globalStorage' } as any,
    logUri: { fsPath: '/mock/log' } as any,
    extensionMode: vscode.ExtensionMode.Test,
    asAbsolutePath: sandbox.stub().callsFake(p => `/mock/extension/${p}`),
    environmentVariableCollection: {} as any
  };
}