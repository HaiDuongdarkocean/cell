/**
 * Configuration for auto-load decision.
 */
export interface AutoLoadConfig {
  readonly autoLoad: boolean;
  readonly targetLanguage: string;
}

/**
 * Configuration for override validation.
 */
export interface OverrideConfig {
  readonly targetLanguage: string;
  readonly fileLanguage: string;
}

export interface OverrideResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Decide whether auto-load should trigger.
 * Auto-load triggers when: autoLoad enabled AND target language is set (non-empty).
 */
export function shouldAutoLoad(config: AutoLoadConfig): boolean {
  return config.autoLoad && config.targetLanguage.trim().length > 0;
}

/**
 * Validate whether a user-dropped/imported subtitle file can override
 * the auto-loaded subtitle.
 *
 * Rule: override allowed only when file language matches target language.
 * When target language is empty (no restriction), any file is allowed.
 *
 * @returns { allowed: true } or { allowed: false, reason }
 */
export function validateOverride(config: OverrideConfig): OverrideResult {
  const target = config.targetLanguage.trim().toLowerCase();

  // No target language set = no restriction
  if (target === '') {
    return { allowed: true };
  }

  const file = config.fileLanguage.trim().toLowerCase();

  if (file === target) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Blocked: file language '${config.fileLanguage}' is different from target language '${config.targetLanguage}'`,
  };
}
