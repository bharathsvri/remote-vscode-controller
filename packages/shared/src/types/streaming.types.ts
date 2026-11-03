export interface ScreenQualityConfig {
  fps: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  bitrateKbps: number;
  scale: number;
}

export const DEFAULT_QUALITY_PRESETS: Record<string, ScreenQualityConfig> = {
  low: { fps: 15, quality: 'low', bitrateKbps: 800, scale: 0.75 },
  medium: { fps: 30, quality: 'medium', bitrateKbps: 2000, scale: 1.0 },
  high: { fps: 60, quality: 'high', bitrateKbps: 4500, scale: 1.0 },
  ultra: { fps: 60, quality: 'ultra', bitrateKbps: 8000, scale: 1.0 },
};

export interface WebRTCSignalingMessage {
  sessionId: string;
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: any;
  candidate?: any;
}
