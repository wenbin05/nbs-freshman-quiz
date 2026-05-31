const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
const emojiJoinerPattern = /[\u200d\ufe0e\ufe0f]/g;

export function stripEmoji(text: string): string {
  return text
    .replace(emojiPattern, "")
    .replace(emojiJoinerPattern, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n");
}

export function cleanText(text: string): string {
  return stripEmoji(text).trim();
}
