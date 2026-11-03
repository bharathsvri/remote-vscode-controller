import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { DEFAULT_PORTS } from '@remote-vscode/shared';
import { ProviderAgent } from './agent/provider-agent';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SIGNALING_URL = process.env.PROVIDER_SIGNALING_URL || `ws://localhost:${DEFAULT_PORTS.SIGNALING_SERVER}/ws`;
const PORT = parseInt(process.env.PROVIDER_PORT || '', 10) || DEFAULT_PORTS.PROVIDER_AGENT;

// Configurable allowed workspaces; defaults to current directory or user documents
const defaultWorkspace = process.env.PROVIDER_DEFAULT_WORKSPACE
  ? path.resolve(process.env.PROVIDER_DEFAULT_WORKSPACE)
  : path.resolve(process.cwd());

const allowedWorkspacesStr = process.env.PROVIDER_ALLOWED_WORKSPACES || defaultWorkspace;
const allowedWorkspaces = allowedWorkspacesStr.split(';').map(w => path.resolve(w.trim())).filter(Boolean);

console.log('=============================================================');
console.log('🚀 Remote VS Code Controller - Provider Agent');
console.log(`🏠 Default Workspace: ${defaultWorkspace}`);
console.log(`📂 Authorized Workspaces: ${allowedWorkspaces.join(', ')}`);
console.log('=============================================================');

const agent = new ProviderAgent({
  signalingUrl: SIGNALING_URL,
  port: PORT,
  allowedWorkspaces,
  defaultWorkspace,
});

agent.start().catch((err) => {
  console.error('[ProviderAgent] Fatal Error starting agent:', err);
  process.exit(1);
});

// Handle graceful termination
const cleanup = async () => {
  console.log('\n[ProviderAgent] Shutting down Provider Agent...');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
