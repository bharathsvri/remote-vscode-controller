import http from 'http';
import dotenv from 'dotenv';
import { DEFAULT_PORTS } from '@remote-vscode/shared';
import { createExpressApp } from './api/rest-server';
import { SignalingWsServer } from './websocket/ws-server';

dotenv.config();

const PORT = parseInt(process.env.SIGNALING_PORT || '', 10) || DEFAULT_PORTS.SIGNALING_SERVER;
const HOST = process.env.SIGNALING_HOST || '0.0.0.0';

const app = createExpressApp();
const server = http.createServer(app);

// Attach WebSocket signaling server
const wsServer = new SignalingWsServer(server);

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Remote VS Code Controller Signaling Server`);
  console.log(`📡 Listening on http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket available at ws://${HOST}:${PORT}/ws`);
  console.log(`=======================================================`);
});
