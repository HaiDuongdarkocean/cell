import type { SrsStudyConfig } from '@/entities/srs/types';

/** Default study config for a new SRS collection. */
export function createDefaultStudyConfig(id: string): SrsStudyConfig {
  return {
    id,
    targetThreshold: 90,
    learningPath: {
      stages: ['sound', 'meaning', 'spelling'],
      progressionMode: 'parallel',
      minExplores: 1,
    },
    progressConstants: {
      rememberGainBase: 20,
      rememberGainMin: 1,
      forgetPenaltyBase: 12,
      forgetPenaltyStep: 0.1,
    },
  };
}
