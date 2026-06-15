/**
 * Resolves spintax strings.
 * Example: "{Hi|Hello|Hey} {Name}, how are you?" -> "Hello {Name}, how are you?"
 * Supports nested spintax.
 */
export function parseSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]*)\}/g;

  let parsed = text;
  while (spintaxRegex.test(parsed)) {
    parsed = parsed.replace(spintaxRegex, (_, options) => {
      const choices = options.split('|');
      const randomChoice = choices[Math.floor(Math.random() * choices.length)];
      return randomChoice;
    });
  }

  return parsed;
}
