// Lightweight matching for mixed Chinese/English questions over curated public text.
// Chinese has no spaces, so a question is split into CJK character bigrams plus
// ASCII words; bigrams containing common function characters are dropped.

const functionChars = new Set(
  "的了和与或在想找能我些个有吗呢是要去做给把被对从向为以及等这那哪什么怎样如何一也都就还很更最可".split(
    "",
  ),
);

const cjk = /[\u3400-\u9fff]/;

export function matchTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const word of text.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? []) {
    if (word.length >= 2) tokens.add(word);
  }
  for (const run of text.match(/[\u3400-\u9fff]+/g) ?? []) {
    if (run.length === 1) continue;
    for (let index = 0; index < run.length - 1; index += 1) {
      const pair = run.slice(index, index + 2);
      if (!functionChars.has(pair[0]) && !functionChars.has(pair[1])) tokens.add(pair);
    }
  }
  return [...tokens];
}

/** Matched query tokens in the text, longest first; empty when nothing matches. */
export function matchedTerms(query: string, text: string): string[] {
  const haystack = text.toLowerCase();
  return matchTokens(query)
    .filter((token) => haystack.includes(token))
    .sort((a, b) => b.length - a.length);
}

/**
 * Score is the weighted count of query tokens found in the text: ASCII words count
 * double because they are usually names or technical terms. 0 means no match.
 */
export function matchScore(query: string, text: string): number {
  return matchedTerms(query, text).reduce(
    (sum, token) => sum + (cjk.test(token) ? 1 : 2),
    0,
  );
}
