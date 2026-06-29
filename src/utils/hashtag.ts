export function parseHashtags(content: string): string[] {
  const hashtagRegex = /#[\wㄱ-ㅎㅏ-ㅣ가-힣]+/g;
  const matches = content.match(hashtagRegex);
  if (!matches) return [];
  // remove the # symbol and return unique tags
  return Array.from(new Set(matches.map(tag => tag.slice(1))));
}
