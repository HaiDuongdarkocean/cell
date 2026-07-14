/* ============================================================
   fixtures.js — mock data (no real API calls)
   ============================================================ */

export const FIXTURES = {
  hello: {
    target: 'hello',
    reading: '/həˈləʊ/',
    readingKind: 'ipa',
    status: 'unknown',
    frequency: { rank: 199, source: 'Netflix' },
    definitions: [
      { id: 1, pos: 'exclamation', text: 'Used as a greeting or to begin a phone conversation.', source: 'Cambridge', example: 'Hello, how are you today?' },
      { id: 2, pos: 'noun', text: 'An utterance of "hello"; a greeting.', source: 'Cambridge', example: 'She gave a warm hello.' },
      { id: 3, pos: 'verb', text: 'To greet with "hello".', source: 'Eng-Vi', example: 'He helloed me across the street.' },
    ],
    audio: {
    word: [
      { id: 'forvo-us', label: 'Forvo · US native', source: 'forvo' },
      { id: 'forvo-uk', label: 'Forvo · UK native', source: 'forvo' },
      { id: 'tts-us', label: 'Google Text-to-Speech (Male)', source: 'tts' },
      { id: 'tts-us-female', label: 'Google Text-to-Speech (Female)', source: 'tts' },
    ],
    sentence: [
      { id: 'tts-male', label: 'Andrew (Male from United States)', source: 'tts' },
    ],
  },
    images: [
      { id: 1, alt: 'Image result for hello', url: '' },
      { id: 2, alt: 'Image result for hello', url: '' },
      { id: 3, alt: 'Image result for hello', url: '' },
      { id: 4, alt: 'Image result for hello', url: '' },
      { id: 5, alt: 'Image result for hello', url: '' },
    ],
    translation: { source: 'I heard someone say hello from the other room.', target: 'Tôi nghe thấy ai đó nói xin chào từ phòng bên.' },
    sentence: 'I heard someone say hello from the other room.',
    sentenceTranslation: 'Tôi nghe thấy ai đó nói xin chào từ phòng bên.',
    links: [
      { id: 'cambridge', label: 'Cambridge', url: 'https://dictionary.cambridge.org/dictionary/english/hello' },
      { id: 'oxford', label: 'Oxford', url: 'https://www.oxfordlearnersdictionaries.com/definition/english/hello' },
      { id: 'wiktionary', label: 'Wiktionary', url: 'https://en.wiktionary.org/wiki/hello' },
    ],
  },
  xihuan: {
    target: '喜欢',
    reading: 'xǐ huān',
    readingKind: 'pinyin',
    status: 'unknown',
    frequency: { rank: 1234, source: 'Netflix' },
    definitions: [
      { id: 1, pos: 'verb', text: 'to like, to be fond of', source: 'CC-CEDICT', example: '我很喜欢你 (I like you very much)' },
      { id: 2, pos: 'verb', text: 'to enjoy, to take pleasure in', source: 'CC-CEDICT', example: '' },
    ],
    audio: {
      word: [
        { id: 'tts-male', label: 'System TTS · Male', source: 'tts' },
      ],
      sentence: [],
    },
    images: [],
    translation: { source: '我喜欢你', target: 'thích' },
    sentence: '我很喜欢你',
    sentenceTranslation: 'Tôi rất thích bạn',
    links: [
      { id: 'mdbg', label: 'MDBG', url: 'https://www.mdbg.net/chinese/dictionary?wdqb=喜欢' },
      { id: 'pleco', label: 'Pleco', url: 'https://pleco.com' },
    ],
  },
  notFound: {
    target: 'xyzabc',
    reading: '',
    readingKind: 'ipa',
    status: 'unknown',
    frequency: null,
    definitions: [],
    audio: { word: [], sentence: [] },
    images: [],
    translation: null,
    sentence: '',
    sentenceTranslation: '',
    links: [],
  },
};

export const STATUS_CYCLE = ['unknown', 'known', 'tracking', 'learning', 'ignore'];

export const STATUS_LABELS = {
  unknown: 'Unknown',
  known: 'Known',
  tracking: 'Tracking',
  learning: 'Learning',
  ignore: 'Ignore',
};

export const PANEL_IDS = ['audio', 'image', 'translate', 'links'];

export const PANEL_LABELS = {
  none: 'None',
  audio: 'Audio',
  image: 'Image',
  translate: 'Translate',
  links: 'Links',
};
