import * as path from 'path';
import * as os from 'os';

export function normalizePath(filePath: string): string {
  return filePath.split('\\').join('/');
}

export function getPythonCommand(): string {
  return os.platform() === 'win32' ? 'python' : 'python3';
}

export function getTempFilePath(taskPath: string): string {
  return path.join(taskPath, '.test_results.txt');
}