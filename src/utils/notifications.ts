import * as vscode from 'vscode';
const DEFAULT_TIMEOUT = 2000;

export function showTemporaryInformationMessage(message: string, timeout: number = DEFAULT_TIMEOUT): void {
    const messagePromise = vscode.window.showInformationMessage(message);

    setTimeout(() => {
        messagePromise.then(result => {
        });
    }, timeout);
}

export function showTemporaryErrorMessage(message: string, timeout: number = DEFAULT_TIMEOUT): void {
    const messagePromise = vscode.window.showErrorMessage(message);

    setTimeout(() => {
        messagePromise.then(result => {
        });
    }, timeout);
}