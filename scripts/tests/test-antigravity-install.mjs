import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const installPath = path.join(repoRoot, "install.ps1");

function run(name, fn) {
  fn();
  console.log(`pass  ${name}`);
}

function checkBalancedDelimiters(scriptText) {
  let braces = 0;
  let parens = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;

  for (let i = 0; i < scriptText.length; i++) {
    const ch = scriptText[i];
    const next = scriptText[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inSingle) {
      if (ch === "'" && next === "'") {
        i++;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (ch === "`" && i + 1 < scriptText.length) {
        i++;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (ch === "#") {
      inLineComment = true;
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === '"') {
      inDouble = true;
    } else if (ch === "{") {
      braces++;
    } else if (ch === "}") {
      braces--;
      assert.ok(braces >= 0, "Unmatched closing brace in install.ps1");
    } else if (ch === "(") {
      parens++;
    } else if (ch === ")") {
      parens--;
      assert.ok(parens >= 0, "Unmatched closing parenthesis in install.ps1");
    }
  }

  assert.equal(inSingle, false, "Unclosed single-quoted string in install.ps1");
  assert.equal(inDouble, false, "Unclosed double-quoted string in install.ps1");
  assert.equal(braces, 0, `Unbalanced braces in install.ps1 (${braces})`);
  assert.equal(parens, 0, `Unbalanced parentheses in install.ps1 (${parens})`);
}

run("test_install_ps1_uses_ps51_safe_syntax", () => {
  const text = fs.readFileSync(installPath, "utf8");
  assert.match(text, /\bparam\s*\(/i);
  assert.match(text, /\$Plugins\b/);
  assert.match(text, /\$Version\b/);
  assert.match(text, /\$Uninstall\b/);
  assert.match(text, /Tls12/);
  assert.match(text, /momochisoundpost\/win-dev-skills-antigravity/);
  assert.match(text, /\.gemini/);
  assert.match(text, /plugins/);
  assert.doesNotMatch(text, /config\.json/i);

  const ps7Only = [/\?\?/, /\?:/, /-AsHashtable\b/i, /-Parallel\b/i, /\$IsWindows\b/i];
  for (const pat of ps7Only) {
    assert.doesNotMatch(text, pat, `PS 7-only construct matched: ${pat}`);
  }
});

run("test_install_ps1_handles_both_zip_layouts_and_fallback", () => {
  const text = fs.readFileSync(installPath, "utf8");
  assert.match(text, /releases\/latest/);
  assert.match(text, /releases\/download/);
  assert.match(text, /refs\/heads\/main\.zip/);
  assert.match(text, /antigravity/);
  assert.match(text, /ZipFile/);
  assert.match(text, /Customizations/);
  checkBalancedDelimiters(text);
});
