/** @typedef {{ path: string; value: string }} FlatEntry */

/**
 * @param {unknown} value
 * @param {string} prefix
 * @returns {FlatEntry[]}
 */
export function flattenMessages(value, prefix = '') {
  /** @type {FlatEntry[]} */
  const entries = [];

  if (typeof value === 'string') {
    entries.push({ path: prefix, value });
    return entries;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === 'string') {
        entries.push({ path: `${prefix}[${index}]`, value: item });
      }
    });
    return entries;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = prefix ? `${prefix}.${key}` : key;
      entries.push(...flattenMessages(nested, nextPath));
    }
  }

  return entries;
}

/**
 * @param {FlatEntry[]} entries
 * @returns {Record<string, unknown>}
 */
export function unflattenMessages(entries) {
  /** @type {Record<string, unknown>} */
  const root = {};

  for (const { path, value } of entries) {
    const tokens = path.split('.');
    /** @type {unknown[]} */
    const stack = [root];

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const arrayMatch = token.match(/^(.+)\[(\d+)\]$/);

      if (arrayMatch) {
        const [, key, rawIndex] = arrayMatch;
        const parent = /** @type {Record<string, unknown>} */ (stack[stack.length - 1]);
        if (!Array.isArray(parent[key])) {
          parent[key] = [];
        }
        const array = /** @type {unknown[]} */ (parent[key]);
        const arrayIndex = Number(rawIndex);

        if (index === tokens.length - 1) {
          array[arrayIndex] = value;
          break;
        }

        if (array[arrayIndex] == null || typeof array[arrayIndex] !== 'object') {
          array[arrayIndex] = {};
        }

        stack.push(array[arrayIndex]);
        continue;
      }

      const parent = /** @type {Record<string, unknown>} */ (stack[stack.length - 1]);

      if (index === tokens.length - 1) {
        parent[token] = value;
        break;
      }

      if (parent[token] == null || typeof parent[token] !== 'object' || Array.isArray(parent[token])) {
        parent[token] = {};
      }

      stack.push(parent[token]);
    }
  }

  return root;
}

const PLACEHOLDER_PATTERN = /\{[a-zA-Z0-9_]+\}/g;

/** @param {string} text */
export function protectPlaceholders(text) {
  /** @type {string[]} */
  const placeholders = [];
  const protectedText = text.replace(PLACEHOLDER_PATTERN, (match) => {
    placeholders.push(match);
    return `__PH_${placeholders.length - 1}__`;
  });
  return { protectedText, placeholders };
}

/** @param {string} text @param {string[]} placeholders */
export function restorePlaceholders(text, placeholders) {
  return placeholders.reduce(
    (result, placeholder, index) => result.replaceAll(`__PH_${index}__`, placeholder),
    text
  );
}

/**
 * @param {unknown} value
 * @param {number} indent
 * @returns {string}
 */
export function stringifyMessageValue(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === 'string')) {
      const items = value.map((item) => `${inner}${JSON.stringify(item)}`).join(',\n');
      return `[\n${items}\n${pad}]`;
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const lines = Object.entries(value).map(([key, nested]) => {
      const keyPrefix = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key);
      return `${inner}${keyPrefix}: ${stringifyMessageValue(nested, indent + 1)}`;
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }

  return JSON.stringify(value);
}
