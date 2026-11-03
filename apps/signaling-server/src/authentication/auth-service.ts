import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'remote-vscode-secret-key-32-chars-long!';

export interface TokenPayload {
  deviceId: string;
  role: 'controller' | 'provider' | 'admin';
  sessionId?: string;
  name?: string;
}

export class AuthService {
  public static generateToken(payload: TokenPayload, expiresIn: string = '24h'): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
  }

  public static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  }

  public static generateSessionToken(controllerId: string, providerId: string, sessionId: string): string {
    return jwt.sign(
      {
        deviceId: controllerId,
        providerId,
        sessionId,
        role: 'controller',
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
  }
}
