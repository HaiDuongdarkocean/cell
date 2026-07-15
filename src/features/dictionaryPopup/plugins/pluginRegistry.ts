// pluginRegistry — spec §4.6.3: registry of language plugins + fallback.
//
// The lookup orchestrator calls getPlugin(langCode) to dispatch to the
// right plugin. Unknown languages get the fallback minimal plugin.

import type { LanguagePlugin } from './languagePlugin';
import { createFallbackPlugin } from './fallbackPlugin';

/** Registry of language plugins. */
export class PluginRegistry {
  private readonly plugins = new Map<string, LanguagePlugin>();

  /** Register a plugin for a language. */
  register(plugin: LanguagePlugin): void {
    this.plugins.set(plugin.langCode, plugin);
  }

  /** Get the plugin for a language, or the fallback if not registered. */
  get(langCode: string): LanguagePlugin {
    return this.plugins.get(langCode) ?? createFallbackPlugin(langCode);
  }

  /** Check if a dedicated plugin exists for a language. */
  has(langCode: string): boolean {
    return this.plugins.has(langCode);
  }

  /** List all registered language codes. */
  listLangs(): readonly string[] {
    return [...this.plugins.keys()];
  }
}

/** Default global registry instance. */
export const pluginRegistry = new PluginRegistry();
