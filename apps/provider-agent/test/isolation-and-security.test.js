const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { IsolationManager } = require('../dist/isolation/isolation-manager.js');
const { FileSystemManager } = require('../dist/filesystem/filesystem-manager.js');
const { PermissionManager } = require('../dist/security/permission-manager.js');

describe('Provider Agent - Isolation & File Sandboxing', () => {
  const tempTestDir = path.join(os.tmpdir(), 'remote-vscode-test-' + Date.now());
  const testWorkspace = path.join(tempTestDir, 'workspace');
  const isolatedBaseDir = path.join(tempTestDir, 'isolated-sessions');

  before(() => {
    fs.mkdirSync(testWorkspace, { recursive: true });
    fs.mkdirSync(isolatedBaseDir, { recursive: true });
    fs.writeFileSync(path.join(testWorkspace, 'hello.txt'), 'Hello Isolated World!');
    fs.mkdirSync(path.join(testWorkspace, 'subfolder'), { recursive: true });
    fs.writeFileSync(path.join(testWorkspace, 'subfolder', 'nested.ts'), 'export const x = 1;');
  });

  after(() => {
    try {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it('IsolationManager establishes isolated user-data and extensions directories', () => {
    const isoMgr = new IsolationManager(isolatedBaseDir);
    const context = isoMgr.prepareIsolatedEnvironment('session-test-01', testWorkspace, 14001, 'token-abc');

    assert.equal(context.sessionId, 'session-test-01');
    assert.equal(context.port, 14001);
    assert.ok(fs.existsSync(context.userDataDir));
    assert.ok(fs.existsSync(context.extensionsDir));

    // Ensure settings.json was initialized with isolated security defaults
    const settingsPath = path.join(context.userDataDir, 'User', 'settings.json');
    assert.ok(fs.existsSync(settingsPath));
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.equal(settings['telemetry.telemetryLevel'], 'off');
    assert.equal(settings['security.workspace.trust.enabled'], false);
  });

  it('FileSystemManager safely lists directories and files within workspace', () => {
    const fsMgr = new FileSystemManager();
    const result = fsMgr.listDirectory(testWorkspace, '');

    assert.equal(result.items.length, 2);
    const names = result.items.map(i => i.name);
    assert.ok(names.includes('hello.txt'));
    assert.ok(names.includes('subfolder'));
  });

  it('FileSystemManager blocks path traversal attempts escaping the workspace', () => {
    const fsMgr = new FileSystemManager();
    assert.throws(() => {
      fsMgr.listDirectory(testWorkspace, '../../');
    }, /Security Violation|outside workspace/);
  });

  it('PermissionManager handles custom approval handlers and decisions', async () => {
    const permMgr = new PermissionManager();
    permMgr.setCustomApprovalHandler(async (req) => {
      return {
        sessionId: req.sessionId,
        approved: true,
        approvedWorkspace: req.requestedWorkspace,
        grantedPermissions: {
          fileRead: true,
          fileWrite: true,
          terminalExecution: false,
          debugging: false,
          clipboardSync: true,
        },
        isolationMode: 'DedicatedServerWeb',
      };
    });

    const decision = await permMgr.requestApproval({
      sessionId: 'session-auth-99',
      controllerId: 'ctrl-1',
      controllerName: 'Admin Laptop',
      requestedWorkspace: testWorkspace,
      requestedPermissions: {
        fileRead: true,
        fileWrite: true,
        terminalExecution: true,
        debugging: true,
        clipboardSync: true,
      },
      timestamp: Date.now(),
    }, testWorkspace);

    assert.equal(decision.approved, true);
    assert.equal(decision.grantedPermissions.terminalExecution, false); // Denied by custom policy
    assert.equal(decision.grantedPermissions.fileRead, true);
  });
});
