const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DeviceRegistry } = require('../dist/device/device-registry.js');
const { AuthService } = require('../dist/authentication/auth-service.js');

describe('Signaling Server - Device Registry & Auth', () => {
  it('registers a device and generates a 6-digit pairing code', () => {
    const registry = new DeviceRegistry();
    const result = registry.register({
      id: 'test-device-1',
      name: 'Windows Test Host',
      os: 'win32',
      osVersion: 'Windows 11 Pro',
      vscodeInstalled: true,
      vscodeVersion: '1.89.0',
    });

    assert.equal(result.device.id, 'test-device-1');
    assert.equal(result.device.status, 'Online');
    assert.match(result.pairingCode, /^[A-Z0-9]{6}$/);

    const retrieved = registry.getDevice('test-device-1');
    assert.ok(retrieved);
    assert.equal(retrieved.name, 'Windows Test Host');
  });

  it('validates device pairing code correctly', () => {
    const registry = new DeviceRegistry();
    const { pairingCode } = registry.register({
      id: 'test-device-2',
      name: 'Office PC',
      os: 'win32',
      osVersion: 'Windows 10',
      vscodeInstalled: true,
    });

    assert.equal(registry.verifyPairing('test-device-2', pairingCode), true);
    assert.equal(registry.verifyPairing('test-device-2', 'WRONG1'), false);
    assert.equal(registry.verifyPairing('non-existent', pairingCode), false);
  });

  it('generates and validates session JWT tokens', () => {
    const token = AuthService.generateToken({
      deviceId: 'test-device-1',
      role: 'controller',
      sessionId: 'session-xyz-123',
    });

    assert.ok(token);
    assert.equal(typeof token, 'string');

    const decoded = AuthService.verifyToken(token);
    assert.ok(decoded);
    assert.equal(decoded.sessionId, 'session-xyz-123');
    assert.equal(decoded.deviceId, 'test-device-1');
    assert.equal(decoded.role, 'controller');
  });
});
