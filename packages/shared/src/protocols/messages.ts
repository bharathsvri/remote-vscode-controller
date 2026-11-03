export interface Envelope<T = any> {
  id: string;
  type: string;
  senderId?: string;
  targetId?: string;
  sessionId?: string;
  token?: string;
  payload: T;
  timestamp: number;
}

export function createEnvelope<T>(
  type: string,
  payload: T,
  options?: {
    id?: string;
    senderId?: string;
    targetId?: string;
    sessionId?: string;
    token?: string;
  }
): Envelope<T> {
  return {
    id: options?.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    senderId: options?.senderId,
    targetId: options?.targetId,
    sessionId: options?.sessionId,
    token: options?.token,
    payload,
    timestamp: Date.now(),
  };
}

export function isEnvelope(data: unknown): data is Envelope {
  if (typeof data !== 'object' || data === null) return false;
  const env = data as Record<string, unknown>;
  return (
    typeof env.id === 'string' &&
    typeof env.type === 'string' &&
    'payload' in env &&
    typeof env.timestamp === 'number'
  );
}
