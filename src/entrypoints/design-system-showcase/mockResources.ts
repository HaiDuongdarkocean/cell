import type { ResourceInfo, ImportFormat, ResourceType } from '@/entities/dictionary';
import { SHOWCASE_DATA, type DataVariant } from './showcaseParams';

const OVERFLOW_LONG_NAME = `${'A'.repeat(120)}🎌${'あ'.repeat(60)}${'中'.repeat(50)}`;
const OVERFLOW_MIXED = '日本語🎌😀TiếngViệtEnglish한국어中文';

function makeResource(
  id: number,
  name: string,
  type: ResourceType,
  format: ImportFormat,
  langCode: string,
  priority: number,
): ResourceInfo {
  return {
    id,
    name,
    langCode,
    type,
    format,
    signature: `${name}-${id}-${Date.now()}`,
    wordCount: type === 'DICTIONARY' ? 100_000 : 50_000,
    installationFinished: true,
    importedAt: Date.now() - id * 60_000,
    enabled: true,
    priority,
    profileIds: [],
    metadata: {},
  };
}

function buildFullResources(): ResourceInfo[] {
  return [
    makeResource(1, 'CC-CEDICT (en)', 'DICTIONARY', 'yomitan', 'en', 0),
    makeResource(2, 'Oxford English Dictionary', 'DICTIONARY', 'json-array', 'en', 1),
    makeResource(3, 'Wordfreq top 50k', 'FREQUENCY', 'txt', 'en', 2),
  ];
}

function buildOverflowResources(): ResourceInfo[] {
  const resources: ResourceInfo[] = [];
  let id = 1;
  for (let i = 0; i < 60; i += 1) {
    let name: string;
    if (i === 0) {
      name = OVERFLOW_LONG_NAME;
    } else if (i === 1) {
      name = '';
    } else if (i === 2) {
      name = 'X';
    } else if (i === 3) {
      name = OVERFLOW_MIXED;
    } else {
      name = `Resource ${i + 1} — ${i % 2 === 0 ? 'Dictionary' : 'Frequency'}`;
    }
    const type: ResourceType = i % 2 === 0 ? 'DICTIONARY' : 'FREQUENCY';
    const format: ImportFormat = type === 'DICTIONARY' ? 'json-array' : 'txt';
    resources.push(makeResource(id, name, type, format, 'en', i));
    id += 1;
  }
  return resources;
}

export function getMockResources(variant: DataVariant = SHOWCASE_DATA): ResourceInfo[] {
  switch (variant) {
    case 'empty':
      return [];
    case 'overflow':
      return buildOverflowResources();
    case 'full':
    default:
      return buildFullResources();
  }
}

export function getMockResourcesForLang(_langCode: string, variant: DataVariant = SHOWCASE_DATA): ResourceInfo[] {
  // Showcase fixtures are all English-targeted; filtering would hide them when
  // a panel asks for a different lang. Return the full variant list regardless.
  return getMockResources(variant);
}
