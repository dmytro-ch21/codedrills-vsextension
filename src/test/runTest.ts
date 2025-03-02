import * as path from 'path';
import { runTests } from 'vscode-test';

async function main() {
  try {
    console.log('Setting up test environment...');
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    
    console.log('Running tests with paths:');
    console.log('- Development path:', extensionDevelopmentPath);
    console.log('- Tests path:', extensionTestsPath);
    
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-workspace-trust',
        '--log=debug'
      ],
      extensionTestsEnv: {
        VSCODE_TEST_TIMEOUT: '30000',
        NODE_ENV: 'test'
      }
    });
    
    console.log('Tests completed successfully');
  } catch (err) {
    console.error('Failed to run tests');
    console.error(err);
    process.exit(1);
  }
}

main();