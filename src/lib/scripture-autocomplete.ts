/**
 * Pure predicate and helpers for scripture reference autocomplete.
 * Separated from ScriptureRefAutocomplete.tsx for direct testability and zero-DOM execution.
 */

export function shouldSuggestBooks(query: string): boolean {
  if (!query) return false;
  const q = query.trim();
  if (q.length === 0) return false;
  if (/:\s*\d/.test(q)) return false;

  const tokens = q.split(/\s+/);
  if (tokens.length === 0) return false;

  const isLeadingNumber = /^\d+$/.test(tokens[0]);
  const lastToken = tokens[tokens.length - 1];
  const lastIsDigits = /^\d+/.test(lastToken);

  if (isLeadingNumber) {
    // e.g. "1", "1 C", "1 Cor", "1 Corinthians" -> true
    // "1 Corinthians 13", "1 Cor 13" -> false
    if (tokens.length >= 3 && lastIsDigits) {
      return false;
    }
    return true;
  }

  // Standard books: e.g. "mat", "Matthew" -> true
  // "Matthew 4", "Mat 4", "Matthew 0" -> false
  if (tokens.length >= 2 && lastIsDigits) {
    return false;
  }
  return true;
}
