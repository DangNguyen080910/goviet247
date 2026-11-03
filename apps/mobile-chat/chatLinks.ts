export type ChatTextPart = { text: string; url?: string };
// Only ordinary web links are tappable; never execute arbitrary pasted schemes.
export function splitChatLinks(text: string): ChatTextPart[] {
  const parts: ChatTextPart[] = [];
  const pattern = /https?:\/\/[^\s<>]+/gi;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    const raw = match[0];
    const url = raw.replace(/[.,!?;:)}\]”’]+$/, '');
    let safe = false;
    try { const parsed = new URL(url); safe = ['https:', 'http:'].includes(parsed.protocol) && Boolean(parsed.hostname) && !parsed.username && !parsed.password; } catch {}
    parts.push(safe ? {text: url, url} : {text: url});
    if (url.length < raw.length) parts.push({text: raw.slice(url.length)});
    cursor = start + raw.length;
  }
  if (cursor < text.length) parts.push({text: text.slice(cursor)});
  return parts;
}
