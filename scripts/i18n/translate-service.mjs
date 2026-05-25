import { translate as translateX } from 'google-translate-api-x';
import translateLegacy from 'translate-google';
import { protectPlaceholders, restorePlaceholders } from './message-utils.mjs';

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {string} text @param {string} googleCode @param {number} attempt */
async function translateWithProvider(text, googleCode, attempt, provider) {
  const { protectedText, placeholders } = protectPlaceholders(text);

  if (provider === 'legacy') {
    const translated = await translateLegacy(protectedText, { from: 'es', to: googleCode });
    const value = Array.isArray(translated) ? translated[0] : translated;
    return restorePlaceholders(String(value ?? protectedText), placeholders);
  }

  const result = await translateX(protectedText, { from: 'es', to: googleCode, forceBatch: false });
  const value = Array.isArray(result) ? result[0]?.text ?? result[0] : result.text;
  return restorePlaceholders(String(value ?? protectedText), placeholders);
}

/** @param {string} text @param {string} googleCode */
export async function translateText(text, googleCode) {
  const providers = ['primary', 'legacy'];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    for (const provider of providers) {
      try {
        const translated = await translateWithProvider(text, googleCode, attempt, provider);
        if (translated && translated !== text) {
          return translated;
        }
        if (translated) {
          return translated;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isRateLimit = message.includes('429') || message.toLowerCase().includes('too many');
        if (isRateLimit) {
          await sleep(BASE_DELAY_MS * 2 ** attempt);
        }
      }
    }

    await sleep(BASE_DELAY_MS * (attempt + 1));
  }

  return text;
}

/** @param {string[]} texts @param {string} googleCode */
export async function translateBatch(texts, googleCode) {
  if (texts.length === 0) {
    return [];
  }

  if (texts.length === 1) {
    return [await translateText(texts[0], googleCode)];
  }

  const protectedEntries = texts.map((text) => protectPlaceholders(text));
  const payload = protectedEntries.map((entry) => entry.protectedText);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const result = await translateX(payload, { from: 'es', to: googleCode, forceBatch: true });
      const items = Array.isArray(result) ? result : [result];

      if (items.length !== payload.length) {
        throw new Error(`Batch size mismatch: expected ${payload.length}, got ${items.length}`);
      }

      return items.map((item, index) => {
        const raw = typeof item === 'string' ? item : item.text;
        return restorePlaceholders(String(raw ?? protectedEntries[index].protectedText), protectedEntries[index].placeholders);
      });
    } catch {
      await sleep(BASE_DELAY_MS * 2 ** attempt);
    }
  }

  /** Fallback: translate individually to preserve order. */
  const output = [];
  for (const text of texts) {
    output.push(await translateText(text, googleCode));
    await sleep(120);
  }
  return output;
}
