/** Shared text helpers for translation providers. */

export function normalizeText(text) {
  const leadingWhitespace = text.match(/^\s*/)?.[0] || '';
  const trailingWhitespace = text.match(/\s*$/)?.[0] || '';
  const content = text.slice(
    leadingWhitespace.length,
    text.length - trailingWhitespace.length
  );

  if (!content) throw new Error('Пустой текст');
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
