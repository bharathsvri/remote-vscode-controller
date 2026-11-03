import readline from 'readline';
import { SessionApprovalDecision, SessionApprovalRequest, SessionPermissions } from '@remote-vscode/shared';

export type ApprovalHandler = (req: SessionApprovalRequest) => Promise<SessionApprovalDecision>;

export class PermissionManager {
  private activeApprovals = new Map<string, SessionApprovalRequest>();
  private customApprovalHandler?: ApprovalHandler;
  private autoApprove: boolean = false;

  constructor() {
    this.autoApprove = process.env.PROVIDER_AUTO_APPROVE === 'true';
  }

  public setCustomApprovalHandler(handler: ApprovalHandler): void {
    this.customApprovalHandler = handler;
  }

  public async requestApproval(request: SessionApprovalRequest, defaultWorkspace: string): Promise<SessionApprovalDecision> {
    this.activeApprovals.set(request.sessionId, request);

    if (this.customApprovalHandler) {
      return this.customApprovalHandler(request);
    }

    if (this.autoApprove) {
      console.log(`[PermissionManager] Auto-approving session ${request.sessionId} (PROVIDER_AUTO_APPROVE=true)`);
      return {
        sessionId: request.sessionId,
        approved: true,
        approvedWorkspace: request.requestedWorkspace || defaultWorkspace,
        grantedPermissions: request.requestedPermissions,
        isolationMode: 'DedicatedServerWeb',
      };
    }

    // Interactive CLI approval prompt
    return this.promptConsoleApproval(request, defaultWorkspace);
  }

  public revokeSession(sessionId: string): void {
    this.activeApprovals.delete(sessionId);
  }

  private promptConsoleApproval(request: SessionApprovalRequest, defaultWorkspace: string): Promise<SessionApprovalDecision> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log('\n=============================================================');
      console.log('🚨 INCOMING REMOTE VS CODE ACCESS REQUEST');
      console.log(`Controller Name:     ${request.controllerName}`);
      console.log(`Controller Device:   ${request.controllerDeviceId}`);
      console.log(`Requested Workspace: ${request.requestedWorkspace || defaultWorkspace}`);
      console.log(`Permissions:         Read:${request.requestedPermissions.fileRead}, Write:${request.requestedPermissions.fileWrite}, Terminal:${request.requestedPermissions.terminalExecute}`);
      console.log('=============================================================');

      rl.question('Approve remote access? [Y/n/workspace_path]: ', (answer) => {
        rl.close();
        const trimmed = answer.trim();

        if (trimmed.toLowerCase() === 'n' || trimmed.toLowerCase() === 'no') {
          resolve({
            sessionId: request.sessionId,
            approved: false,
            reason: 'Provider rejected the remote connection request.',
            isolationMode: 'DedicatedServerWeb',
          });
        } else {
          // If user typed a custom workspace path, use it; otherwise use requested or default
          let workspace = request.requestedWorkspace || defaultWorkspace;
          if (trimmed.length > 2 && trimmed.toLowerCase() !== 'y' && trimmed.toLowerCase() !== 'yes') {
            workspace = trimmed;
          }

          resolve({
            sessionId: request.sessionId,
            approved: true,
            approvedWorkspace: workspace,
            grantedPermissions: request.requestedPermissions,
            isolationMode: 'DedicatedServerWeb',
          });
        }
      });
    });
  }
}

export const permissionManager = new PermissionManager();
