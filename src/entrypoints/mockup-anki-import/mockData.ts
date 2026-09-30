export interface MockDeck {
  id: string;
  name: string;
  counts: { label: string; value: number; tone: 'info' | 'warn' | 'muted' }[];
  disabled?: boolean;
}

export interface MockNotetype {
  id: string;
  name: string;
  noteCount: number;
  cloze?: boolean;
}

export interface MockField {
  name: string;
  role: string;
}

export const MOCK_DECKS: MockDeck[] = [
  {
    id: 'd1',
    name: 'Languages › Japanese › Core2k',
    counts: [
      { label: 'mới', value: 237, tone: 'info' },
      { label: 'ôn', value: 235, tone: 'info' },
    ],
  },
  {
    id: 'd2',
    name: 'Languages › Japanese › Mining',
    counts: [
      { label: 'mới', value: 40, tone: 'info' },
      { label: 'tạm dừng (bỏ qua)', value: 5, tone: 'warn' },
    ],
  },
  {
    id: 'd3',
    name: 'Languages › English › Phrasal verbs',
    counts: [{ label: 'ôn', value: 112, tone: 'info' }],
  },
];

export const MOCK_NOTETYPES: MockNotetype[] = [
  { id: 'nt-basic', name: 'Basic', noteCount: 512 },
  { id: 'nt-mining', name: 'Japanese mining', noteCount: 128 },
  { id: 'nt-cloze', name: 'Cloze', noteCount: 128, cloze: true },
];

export const MOCK_FIELDS: Record<string, MockField[]> = {
  'nt-basic': [
    { name: 'Expression', role: 'target' },
    { name: 'Meaning', role: 'definition' },
    { name: 'Sentence', role: 'sentence' },
    { name: 'Audio', role: 'audio' },
    { name: 'Picture', role: 'image' },
    { name: 'Extra', role: 'skip' },
  ],
  'nt-mining': [
    { name: 'Word', role: 'target' },
    { name: 'Reading', role: 'context' },
    { name: 'Glossary', role: 'definition' },
    { name: 'Sentence', role: 'sentence' },
    { name: 'SentenceAudio', role: 'audio' },
  ],
};

export const ROLE_OPTIONS = [
  { value: 'target', label: 'Từ mục tiêu' },
  { value: 'definition', label: 'Định nghĩa' },
  { value: 'sentence', label: 'Câu' },
  { value: 'translation', label: 'Bản dịch' },
  { value: 'context', label: 'Ngữ cảnh' },
  { value: 'audio', label: 'Audio' },
  { value: 'image', label: 'Ảnh' },
  { value: 'notes', label: 'Ghi chú' },
  { value: 'skip', label: 'Không import' },
];

export const MOCK_SAMPLES: Record<string, { target: string; reading: string; sentence: string; definition: string; image?: boolean; audio?: boolean }[]> = {
  'nt-basic': [
    {
      target: '捨てる',
      reading: 'すてる',
      sentence: '要らないものは捨てる。',
      definition: 'to throw away, to discard',
      audio: true,
    },
    {
      target: '瞬間',
      reading: 'しゅんかん',
      sentence: 'その瞬間、すべてが変わった。',
      definition: 'moment, instant',
      image: true,
    },
  ],
  'nt-mining': [
    {
      target: 'やり遂げる',
      reading: 'やりとげる',
      sentence: '最後までやり遂げた。',
      definition: 'to accomplish, to see through',
      audio: true,
    },
  ],
};

export const MOCK_LANGUAGES = [
  { value: 'ja', label: 'Japanese' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
];
