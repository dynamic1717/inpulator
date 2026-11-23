/** Shared text helpers for translation providers. */

export function normalizeText(text) {
  const leadingWhitespace = text.match(/^\s*/)?.[0] || '';
  const trailingWhitespace = text.match(/\s*$/)?.[0] || '';
  const content = text.slice(
    leadingWhitespace.length,
    text.length - trailingWhitespace.length
  );

  if (!content) throw new Error('Empty text');
  return { leadingWhitespace, content, trailingWhitespace };
}

// Separators are kept outside API requests so translated chunks never merge words.
export function splitIntoChunks(text, maxSize) {
  const chunks = [];
  let start = 0;

  while (text.length - start > maxSize) {
    const candidate = text.slice(start, start + maxSize + 1);
    const boundary = candidate.slice(0, maxSize + 1).search(/\s(?=[^\s]*$)/);

    if (boundary <= 0) {
      chunks.push({ text: text.slice(start, start + maxSize), separator: '' });
      start += maxSize;
      continue;
    }

    let separatorEnd = start + boundary;
    while (separatorEnd < text.length && /\s/.test(text[separatorEnd])) {
      separatorEnd += 1;
    }

    chunks.push({
      text: text.slice(start, start + boundary),
      separator: text.slice(start + boundary, separatorEnd),
    });
    start = separatorEnd;
  }

  if (start < text.length) chunks.push({ text: text.slice(start), separator: '' });
  return chunks;
}

/**
 * Translates each line separately and keeps the original line breaks and
 * per-line outer whitespace. The Chrome Translator joins lines otherwise.
 * @param {string} text
 * @param {(line: string) => Promise<string>} translateLine
 */
export async function translateByLines(text, translateLine) {
  const parts = String(text).split(/(\r?\n)/);
  let result = '';
  for (const part of parts) {
    if (/^\r?\n$/.test(part) || !part.trim()) {
      result += part;
      continue;
    }
    const leading = part.match(/^\s*/)[0];
    const trailing = part.match(/\s*$/)[0];
    const content = part.slice(leading.length, part.length - trailing.length);
    result += `${leading}${await translateLine(content)}${trailing}`;
  }
  return result;
}
