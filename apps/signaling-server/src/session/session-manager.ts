import {
  ActiveSessionInfo,
  SessionApprovalDecision,
  SessionApprovalRequest,
  SessionAuditLog,
  SessionState,
} from '@remote-vscode/shared';
import { v4 as uuidv4 } from 'uuid';

export class SessionManager {
  private activeSessions = new Map<string, ActiveSessionInfo>();
  private pendingApprovals = new Map<string, SessionApprovalRequest>();
  private auditLogs: SessionAuditLog[] = [];

  public createApprovalRequest(request: Omit<SessionApprovalRequest, 'sessionId' | 'timestamp'>): SessionApprovalRequest {
    const sessionId = uuidv4();
    const approvalReq: SessionApprovalRequest = {
      ...request,
      sessionId,
      timestamp: Date.now(),
    };
    this.pendingApprovals.set(sessionId, approvalReq);

    this.logAudit(sessionId, 'START', `Approval requested by ${request.controllerName} (${request.controllerDeviceId}) for workspace ${request.requestedWorkspace}`, 'Controller');

    return approvalReq;
  }

  public getPendingApproval(sessionId: string): SessionApprovalRequest | undefined {
    return this.pendingApprovals.get(sessionId);
  }

  public handleApprovalDecision(decision: SessionApprovalDecision, providerName: string): ActiveSessionInfo | null {
    const pending = this.pendingApprovals.get(decision.sessionId);
    if (!pending) return null;

    this.pendingApprovals.delete(decision.sessionId);

    if (!decision.approved) {
      this.logAudit(decision.sessionId, 'APPROVAL', `Session rejected by Provider: ${decision.reason || 'No reason provided'}`, 'Provider');
      return null;
    }

    const sessionInfo: ActiveSessionInfo = {
      sessionId: decision.sessionId,
      providerId: '', // populated by caller
      providerName,
      controllerId: pending.controllerDeviceId,
      controllerName: pending.controllerName,
      workspacePath: decision.approvedWorkspace || pending.requestedWorkspace,
      startTime: Date.now(),
      isolationMode: decision.isolationMode,
      port: 0,
      connectionToken: decision.connectionToken || '',
      status: 'Active',
      grantedPermissions: decision.grantedPermissions || pending.requestedPermissions,
      webUrl: decision.webUrl,
    };

    this.activeSessions.set(decision.sessionId, sessionInfo);
    this.logAudit(decision.sessionId, 'APPROVAL', `Session approved by Provider. Mode: ${decision.isolationMode}, Workspace: ${sessionInfo.workspacePath}`, 'Provider');

    return sessionInfo;
  }

  public getSession(sessionId: string): ActiveSessionInfo | undefined {
    return this.activeSessions.get(sessionId);
  }

  public terminateSession(sessionId: string, actor: 'Controller' | 'Provider' | 'System', reason?: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    session.status = 'Terminated';
    this.activeSessions.delete(sessionId);
    this.logAudit(sessionId, 'STOP', `Session terminated by ${actor}. Reason: ${reason || 'User ended session'}`, actor);

    return true;
  }

  public logAudit(sessionId: string, eventType: SessionAuditLog['eventType'], details: string, actor: SessionAuditLog['actor']): void {
    const log: SessionAuditLog = {
      id: uuidv4(),
      sessionId,
      timestamp: Date.now(),
      eventType,
      details,
      actor,
    };
    this.auditLogs.push(log);
    // Keep max 5000 audit logs in memory
    if (this.auditLogs.length > 5000) {
      this.auditLogs.shift();
    }
  }

  public getAuditLogs(sessionId?: string): SessionAuditLog[] {
    if (sessionId) {
      return this.auditLogs.filter(l => l.sessionId === sessionId);
    }
    return [...this.auditLogs];
  }
}

export const sessionManager = new SessionManager();
