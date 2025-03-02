import * as path from 'path';
import Mocha from 'mocha';
import glob from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 20000 
  });

  const testsRoot = path.resolve(__dirname, '.');
  
  return new Promise((resolve, reject) => {
    const testFile = path.resolve(testsRoot, './reportGenerator.test.js');
    mocha.addFile(testFile);
    
    try {
      console.log('Starting test execution with file:', testFile);
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          console.log('Test completed successfully');
          resolve();
        }
      });
    } catch (err) {
      console.error('Error executing tests:', err);
      reject(err);
    }
  });
}