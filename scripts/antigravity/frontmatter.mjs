const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Parse a scalar YAML value (booleans, single/double quoted strings, or unquoted string). */
function parseScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/** Parse a YAML inline array like `[]` or `[a, "b"]`. */
function parseInlineArray(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  const items = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      current += ch;
      if (ch === "\\" && i + 1 < inner.length) {
        current += inner[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ",") {
      items.push(String(parseScalar(current)));
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(String(parseScalar(current)));
  return items;
}

/** Read a YAML block scalar (`>`, `>-`, `|`, `|-`) starting at `startIndex`. */
function readBlockScalar(lines, startIndex, style) {
  const folded = style.startsWith(">");
  const keepTrailingNewline = !style.endsWith("-");
  const collected = [];
  let indent = null;
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      collected.push("");
      i++;
      continue;
    }
    const leading = /^(\s*)/.exec(line)[1].length;
    if (leading === 0) break;
    if (indent === null) indent = leading;
    if (leading < indent) break;
    collected.push(line.slice(indent));
    i++;
  }

  while (collected.length > 0 && collected[collected.length - 1] === "") {
    collected.pop();
  }

  let value = folded ? collected.join(" ").replace(/ +/g, " ") : collected.join("\n");
  if (keepTrailingNewline && value.length > 0) value += "\n";
  return { value, nextIndex: i };
}

/** Read a YAML `- item` sequence starting at `startIndex`. */
function readBlockList(lines, startIndex) {
  const items = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) {
      i++;
      continue;
    }
    const itemMatch = /^\s+-\s+(.*)$/.exec(line);
    if (!itemMatch) break;
    items.push(String(parseScalar(itemMatch[1])));
    i++;
  }
  return { items, nextIndex: i };
}

/**
 * Parse YAML frontmatter and body from a Markdown string.
 * Supports CRLF, folded/literal blocks, quoted scalars, booleans, and string arrays.
 */
export function parseFrontmatter(markdown) {
  const match = FRONTMATTER_RE.exec(markdown);
  if (!match) {
    throw new Error("Missing YAML frontmatter delimited by ---");
  }

  const lineEnding = /\r\n/.test(markdown) ? "\r\n" : "\n";
  const rawYaml = match[1].replace(/\r\n/g, "\n");
  const body = markdown.slice(match[0].length);
  const lines = rawYaml.split("\n");
  const data = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) {
      i++;
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) {
      throw new Error(`Unsupported frontmatter line: ${line}`);
    }
    const [, key, rest] = kv;
    const trimmed = rest.trim();

    if (trimmed === ">" || trimmed === ">-" || trimmed === "|" || trimmed === "|-") {
      const { value, nextIndex } = readBlockScalar(lines, i + 1, trimmed);
      data[key] = value;
      i = nextIndex;
    } else if (trimmed === "") {
      const { items, nextIndex } = readBlockList(lines, i + 1);
      data[key] = items;
      i = nextIndex;
    } else if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      data[key] = parseInlineArray(trimmed);
      i++;
    } else {
      data[key] = parseScalar(trimmed);
      i++;
    }
  }

  return { data, rawYaml, body, lineEnding };
}

/** Format a scalar value safely as single-line YAML. */
function formatYamlScalar(value) {
  if (typeof value === "boolean") return String(value);
  const str = String(value);
  if (
    str === "" ||
    str === "true" ||
    str === "false" ||
    /[:#[\]{}&*!|>'"%@`\n\r]/.test(str) ||
    /^\s|\s$/.test(str)
  ) {
    return JSON.stringify(str);
  }
  return str;
}

/**
 * Serialize a frontmatter object or raw YAML string with a Markdown body.
 */
export function serializeFrontmatter(dataOrYaml, body, lineEnding = "\n") {
  let yamlText;
  if (typeof dataOrYaml === "string") {
    yamlText = dataOrYaml.replace(/\r?\n/g, "\n").trim();
  } else {
    const lines = [];
    for (const [key, value] of Object.entries(dataOrYaml)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${key}: []`);
        } else {
          lines.push(`${key}:`);
          for (const item of value) {
            lines.push(`  - ${formatYamlScalar(item)}`);
          }
        }
      } else {
        lines.push(`${key}: ${formatYamlScalar(value)}`);
      }
    }
    yamlText = lines.join("\n");
  }

  const header = `---\n${yamlText}\n---\n`.replace(/\n/g, lineEnding);
  return `${header}${body}`;
}
