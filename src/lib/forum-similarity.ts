type SimilarityInput = {
  id: string;
  title: string;
  body: string;
};

export type ForumVectorTerm = {
  token: string;
  weight: number;
};

export type StoredQuestionVector = {
  id: string;
  title: string;
  forumVector: ForumVectorTerm[];
  forumTitleVector: ForumVectorTerm[];
};

export type SimilarQuestionMatch = {
  id: string;
  title: string;
  similarity: number;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "in",
  "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when",
  "where", "which", "who", "why", "with", "you", "your",
  "can", "could", "should", "would", "one", "please", "pls", "help", "me", "my",
  "hello", "hi", "hey", "hehe", "huhu", "uh", "um",
]);

export const FORUM_VECTOR_VERSION = 1;
export const SOLVED_SIMILARITY_THRESHOLD = 0.52;

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return normalizeText(text)
    .split(" ")
    .map(stemToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function stemToken(token: string) {
  if (token.length > 4 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 3 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function vectorize(tokens: string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function vectorMapToTerms(vector: Map<string, number>) {
  return Array.from(vector.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([token, weight]) => ({ token, weight }));
}

function termsToVectorMap(terms: ForumVectorTerm[]) {
  return new Map(terms.map((term) => [term.token, term.weight]));
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of left.values()) {
    leftMagnitude += value * value;
  }
  for (const value of right.values()) {
    rightMagnitude += value * value;
  }
  for (const [token, value] of left.entries()) {
    dot += value * (right.get(token) ?? 0);
  }

  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function jaccardSimilarity(leftTokens: string[], rightTokens: string[]) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function encodeForumQuestion(text: Pick<SimilarityInput, "title" | "body">) {
  const draftTitleTokens = tokenize(text.title);
  const draftBodyTokens = tokenize(text.body);
  const draftTokens = [...draftTitleTokens, ...draftBodyTokens];
  const draftVector = vectorize(draftTokens);
  const draftTitleVector = vectorize(draftTitleTokens);

  return {
    forumVector: vectorMapToTerms(draftVector),
    forumTitleVector: vectorMapToTerms(draftTitleVector),
    forumVectorVersion: FORUM_VECTOR_VERSION,
  };
}

export function findSimilarSolvedQuestions(
  draft: Pick<SimilarityInput, "title" | "body">,
  solvedQuestions: StoredQuestionVector[]
) {
  const encodedDraft = encodeForumQuestion(draft);
  const draftVector = termsToVectorMap(encodedDraft.forumVector);
  const draftTitleVector = termsToVectorMap(encodedDraft.forumTitleVector);
  if (draftVector.size === 0) return [];

  const draftTokens = encodedDraft.forumVector.map((term) => term.token);
  const draftTitleTokens = encodedDraft.forumTitleVector.map((term) => term.token);

  const matches: SimilarQuestionMatch[] = [];

  for (const question of solvedQuestions) {
    const solvedTokens = question.forumVector.map((term) => term.token);
    const solvedTitleTokens = question.forumTitleVector.map((term) => term.token);
    const solvedVector = termsToVectorMap(question.forumVector);
    const solvedTitleVector = termsToVectorMap(question.forumTitleVector);

    const fullCosine = cosineSimilarity(draftVector, solvedVector);
    const titleCosine = cosineSimilarity(draftTitleVector, solvedTitleVector);
    const tokenOverlap = jaccardSimilarity(draftTokens, solvedTokens);
    const titleOverlap = jaccardSimilarity(draftTitleTokens, solvedTitleTokens);
    const similarity = Math.max(
      fullCosine,
      titleCosine * 0.9 + titleOverlap * 0.1,
      tokenOverlap * 0.85 + titleOverlap * 0.15
    );

    if (similarity >= SOLVED_SIMILARITY_THRESHOLD) {
      matches.push({
        id: question.id,
        title: question.title,
        similarity,
      });
    }
  }

  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}
