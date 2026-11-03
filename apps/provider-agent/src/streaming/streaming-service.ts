import { DEFAULT_QUALITY_PRESETS, ScreenQualityConfig, WebRTCSignalingMessage } from '@remote-vscode/shared';

export class StreamingService {
  private currentQuality: ScreenQualityConfig = DEFAULT_QUALITY_PRESETS.high;

  public setQuality(qualityName: keyof typeof DEFAULT_QUALITY_PRESETS): ScreenQualityConfig {
    if (DEFAULT_QUALITY_PRESETS[qualityName]) {
      this.currentQuality = DEFAULT_QUALITY_PRESETS[qualityName];
    }
    return this.currentQuality;
  }

  public getQuality(): ScreenQualityConfig {
    return this.currentQuality;
  }

  public handleWebRTCSignal(signal: WebRTCSignalingMessage): any {
    // WebRTC connection signaling handling
    return { status: 'acknowledged', type: signal.type };
  }
}

export const streamingService = new StreamingService();
