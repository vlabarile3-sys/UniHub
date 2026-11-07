import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const sourceDir = join(root, 'source');
const modules = new Map();

function include(name) {
  const file = join(sourceDir, `${name}.html`);
  const content = readFileSync(file, 'utf8');
  const rendered = name === 'CSS' ? content.replace(/\u00a0/g, ' ') : content;
  modules.set(name, rendered);
  return rendered;
}

function evaluateCondition(expression) {
  const value = expression.trim().replace(/\s+/g, ' ');
  if (value === "TEAM_CONTEXT === 'AGENT'") return false;
  if (value === "['QA', 'TL', 'OPS'].includes(TEAM_CONTEXT)") return true;
  if (value === "['QA', 'TL'].includes(TEAM_CONTEXT)") return true;
  throw new Error(`Unsupported Apps Script template condition: ${value}`);
}

function renderTemplate(template) {
  const matcher = /<\?([=!]?)([\s\S]*?)\?>/g;
  const stack = [];
  let active = true;
  let output = '';
  let cursor = 0;
  let match;

  while ((match = matcher.exec(template)) !== null) {
    if (active) output += template.slice(cursor, match.index);
    cursor = matcher.lastIndex;
    const marker = match[1];
    const code = match[2].trim();

    if (marker === '=') {
      if (active) {
        if (code === 'TEAM_CONTEXT') output += 'QA';
        else if (code === "(TEAM_CONTEXT === 'AGENT' ? 'News & Updates' : 'Broadcast Studio')") {
          output += 'Broadcast Studio';
        } else {
          throw new Error(`Unsupported Apps Script template expression: ${code}`);
        }
      }
      continue;
    }

    if (marker === '!') {
      throw new Error(`Unresolved Apps Script include: ${code}`);
    }

    if (code.startsWith('if (') && code.endsWith(') {')) {
      const parentActive = active;
      const condition = evaluateCondition(code.slice(4, -3));
      stack.push({ parentActive, condition, elseSeen: false });
      active = parentActive && condition;
      continue;
    }

    if (code === '} else {') {
      const frame = stack[stack.length - 1];
      if (!frame || frame.elseSeen) throw new Error('Unmatched Apps Script else block.');
      frame.elseSeen = true;
      active = frame.parentActive && !frame.condition;
      continue;
    }

    if (code === '}') {
      const frame = stack.pop();
      if (!frame) throw new Error('Unmatched Apps Script template closing block.');
      active = frame.parentActive;
      continue;
    }

    throw new Error(`Unsupported Apps Script template directive: ${code}`);
  }

  if (stack.length) throw new Error('Unclosed Apps Script template block.');
  if (active) output += template.slice(cursor);
  return output;
}

let html = readFileSync(join(sourceDir, 'Index.html'), 'utf8');
html = html.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_match, name) => include(name));
if (!modules.has('CSS')) throw new Error('The original CSS module was not included.');
html = html.replace(
  '<!-- Moduli JavaScript Architettura Enterprise -->',
  '<!-- Moduli JavaScript Architettura Enterprise -->\n<script src="./demo-bridge.js"></script>'
);
html = renderTemplate(html);
html = html.replace(/\u00a0/g, ' ');
writeFileSync(join(root, 'index.html'), html, 'utf8');
console.log(`Built ${join(root, 'index.html')}`);
