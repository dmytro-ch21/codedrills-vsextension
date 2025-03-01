import * as os from 'os';

export function createCommand(commands: string[]): string {
  return commands.join(' && ');
}

export function escapeFilePath(filePath: string): string {
  if (os.platform() === 'win32') {
    return `"${filePath}"`;
  } else {
    return filePath.replace(/ /g, '\\ ');
  }
}