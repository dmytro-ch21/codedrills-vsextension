const vscode = acquireVsCodeApi();

const runTestsButton = document.getElementById('run-tests');
const openFolderButton = document.getElementById('open-folder');

if (runTestsButton) {
  runTestsButton.addEventListener('click', () => {
    // Send message to extension to run tests
    vscode.postMessage({
      command: 'runTests',
    });
  });
}

if (openFolderButton) {
  openFolderButton.addEventListener('click', () => {
    // Send message to extension to open the task folder
    vscode.postMessage({
      command: 'openFolder',
    });
  });
}
