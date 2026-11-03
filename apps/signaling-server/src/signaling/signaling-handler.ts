import { Envelope, WebRTCSignalingMessage } from '@remote-vscode/shared';
import { WebSocket } from 'ws';
import { deviceRegistry } from '../device/device-registry';

export class SignalingHandler {
  public static handleSignal(env: Envelope<WebRTCSignalingMessage>, senderWs: WebSocket): boolean {
    const targetDeviceId = env.targetId;
    if (!targetDeviceId) {
      senderWs.send(JSON.stringify({
        type: 'error',
        error: 'Target device ID is missing in signaling message',
      }));
      return false;
    }

    const targetSocket = deviceRegistry.getDeviceSocket(targetDeviceId);
    if (!targetSocket || targetSocket.readyState !== WebSocket.OPEN) {
      senderWs.send(JSON.stringify({
        type: 'error',
        error: `Target device ${targetDeviceId} is offline or unreachable`,
      }));
      return false;
    }

    targetSocket.send(JSON.stringify(env));
    return true;
  }
}
