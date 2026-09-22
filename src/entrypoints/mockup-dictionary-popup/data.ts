// Prototype data — mirrors the superset `tihoka-dict v1` shape.
// Every field except `term`/`senses` is optional; renderers skip absent sections.

export interface ProtoLine {
  readonly role: 'gloss' | 'example' | 'note' | 'collocation';
  readonly text: string;
  readonly translation?: string;
  readonly citation?: string;
  readonly pattern?: string;
}

export interface ProtoSense {
  readonly num?: string;
  readonly labels?: readonly string[];
  readonly level?: string;
  readonly lines: readonly ProtoLine[];
  readonly subsenses?: readonly { readonly num: string; readonly text: string }[];
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
  readonly thesaurus?: readonly string[];
  readonly votes?: { readonly up: number; readonly down: number; readonly date?: string };
}

export interface ProtoPosSection {
  readonly pos: string;
  readonly labels?: readonly string[];
  readonly senses: readonly ProtoSense[];
}

export interface ProtoRelated {
  readonly term: string;
  readonly kind: string;
  readonly preview?: string;
}

export interface ProtoEntry {
  readonly term: string;
  readonly homograph?: number;
  readonly pronunciation?: {
    readonly ipa?: string;
    readonly ipaUk?: string;
    readonly ipaUs?: string;
    readonly enPR?: string;
    readonly rhymes?: string;
  };
  readonly frequencyStars?: number;
  readonly level?: string;
  readonly popularity?: string;
  readonly inflections?: readonly { readonly type: string; readonly forms: readonly string[] }[];
  readonly audiences?: readonly string[];
  readonly audienceVariants?: readonly { readonly label: string; readonly sections: readonly ProtoPosSection[] }[];
  readonly menu?: readonly string[];
  readonly sections: readonly ProtoPosSection[];
  readonly related?: readonly ProtoRelated[];
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
  readonly nearAntonyms?: readonly string[];
  readonly thesaurus?: readonly string[];
  readonly wordFamily?: { readonly nouns?: readonly string[]; readonly verbs?: readonly string[]; readonly adjectives?: readonly string[]; readonly adverbs?: readonly string[] };
  readonly wordNet?: { readonly synset?: readonly string[]; readonly hypernyms?: readonly string[] };
  readonly derivedTerms?: readonly string[];
  readonly anagrams?: readonly string[];
  readonly usageNote?: { readonly title: string; readonly text: string };
  readonly synonymDiscussion?: string;
  readonly etymology?: {
    readonly chain: string;
    readonly firstKnownUse?: string;
    readonly variants?: readonly { readonly text: string; readonly source?: string }[];
  };
  readonly recentWebExamples?: readonly { readonly text: string; readonly who: string }[];
  readonly seeAlso?: readonly string[];
  readonly images?: readonly string[];
}
