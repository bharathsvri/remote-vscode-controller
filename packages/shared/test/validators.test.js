const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isPathInsideWorkspace,
  safeResolvePath,
  isValidPairingCode,
  isValidDeviceId,
} = require('../dist/index.js');

describe('Security & Path Traversal Validators', () => {
  const workspace = 'D:/Work/Repositories/Project';

  it('allows files inside authorized workspace', () => {
    assert.equal(isPathInsideWorkspace(workspace, 'D:/Work/Repositories/Project/src/index.ts'), true);
    assert.equal(isPathInsideWorkspace(workspace, 'D:/Work/Repositories/Project/sub/file.txt'), true);
  });

  it('rejects path traversal attempts with ..', () => {
    assert.equal(isPathInsideWorkspace(workspace, 'D:/Work/Repositories/Project/../secret.txt'), false);
    assert.equal(isPathInsideWorkspace(workspace, 'D:/Work/Repositories/'), false);
    assert.equal(isPathInsideWorkspace(workspace, 'C:/Windows/System32/cmd.exe'), false);
  });

  it('safeResolvePath prevents escaping workspace boundary', () => {
    const resolved = safeResolvePath(workspace, 'src/main.ts');
    assert.equal(resolved, 'D:/Work/Repositories/Project/src/main.ts');

    assert.throws(() => {
      safeResolvePath(workspace, '../../etc/passwd');
    }, /Security Violation/);
  });

  it('validates 6-character alphanumeric pairing codes', () => {
    assert.equal(isValidPairingCode('ABC123'), true);
    assert.equal(isValidPairingCode('XYZ999'), true);
    assert.equal(isValidPairingCode('12345'), false); // too short
    assert.equal(isValidPairingCode('TOOLONG1'), false); // too long
    assert.equal(isValidPairingCode('ABC!23'), false); // invalid character
  });

  it('validates device ID format', () => {
    assert.equal(isValidDeviceId('device-abc-12345'), true);
    assert.equal(isValidDeviceId('short'), false); // < 8 chars
  });
});
