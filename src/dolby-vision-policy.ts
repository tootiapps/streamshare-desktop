import type { DolbyVisionMode } from './settings-store.js';

export interface DolbyVisionPlaybackDecision {
  transcodeVideo: boolean;
  toneMapDolbyVision: boolean;
  nativeDolbyVisionSupported?: boolean;
}

export function compatibilityVideoOptions(decision: DolbyVisionPlaybackDecision): {
  transcodeVideo: boolean;
  toneMapDolbyVision: boolean;
} {
  return {
    transcodeVideo: decision.transcodeVideo,
    toneMapDolbyVision: decision.toneMapDolbyVision
  };
}

export function resolveDolbyVisionPlayback(
  mode: DolbyVisionMode,
  profile: number | undefined,
  genericVideoFallback: boolean,
  nativeDolbyVisionSupported?: boolean
): DolbyVisionPlaybackDecision {
  if (profile !== 5) {
    return { transcodeVideo: genericVideoFallback, toneMapDolbyVision: false };
  }
  if (mode === 'native') {
    return { transcodeVideo: false, toneMapDolbyVision: false };
  }
  if (mode === 'sdr') {
    return { transcodeVideo: true, toneMapDolbyVision: true };
  }
  return {
    transcodeVideo: nativeDolbyVisionSupported !== true,
    toneMapDolbyVision: nativeDolbyVisionSupported !== true,
    nativeDolbyVisionSupported
  };
}
