import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Static Audit Test for i18n Localization Keys
 * 
 * Verifies that all static calls to `t('literal_key')` or `t("literal_key")`
 * across all source files in `src/` (excluding `src/locales/`) resolve to a defined key
 * in both `src/locales/vi.json` and `src/locales/en.json`.
 * 
 * LIMITATION NOTE:
 * Dynamically constructed keys (such as `t(\`namespace.${variable}\`)` or `t(dynamicVar)`)
 * are excluded from static AST/regex analysis and must be verified via integration or runtime testing.
 */

function flattenDictionary(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(flattened, flattenDictionary(val, fullKey));
    } else {
      flattened[fullKey] = val;
    }
  }
  return flattened;
}

function findSourceFiles(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fullPath.includes('locales') || fullPath.includes('node_modules')) continue;
      findSourceFiles(fullPath, fileList);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('i18n Static Audit: 100% Key Parity & Zero Missing Keys', () => {
  const viRaw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/vi.json'), 'utf-8'));
  const enRaw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/locales/en.json'), 'utf-8'));

  const viKeys = new Set(Object.keys(flattenDictionary(viRaw)));
  const enKeys = new Set(Object.keys(flattenDictionary(enRaw)));

  it('1. vi.json and en.json have identical key structures (1:1 parity)', () => {
    const missingInEn = [...viKeys].filter((k) => !enKeys.has(k));
    const missingInVi = [...enKeys].filter((k) => !viKeys.has(k));

    expect(missingInEn, `Keys present in vi.json but missing in en.json: ${missingInEn.join(', ')}`).toEqual([]);
    expect(missingInVi, `Keys present in en.json but missing in vi.json: ${missingInVi.join(', ')}`).toEqual([]);
  });

  it('2. All static t("...") invocations in src/ have defined translations in both vi.json and en.json', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const sourceFiles = findSourceFiles(srcDir);
    const staticCallRegex = /\bt\(\s*['"]([A-Za-z0-9_.\-]+)['"]/g;

    const usedKeysWithLocations: { key: string; file: string; line: number }[] = [];

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let match: RegExpExecArray | null;
        while ((match = staticCallRegex.exec(line)) !== null) {
          usedKeysWithLocations.push({
            key: match[1],
            file: path.relative(path.resolve(__dirname, '..'), filePath),
            line: lineIndex + 1,
          });
        }
      }
    }

    const missingInEn: string[] = [];
    const missingInVi: string[] = [];

    for (const item of usedKeysWithLocations) {
      if (!enKeys.has(item.key)) {
        missingInEn.push(`${item.key} (${item.file}:${item.line})`);
      }
      if (!viKeys.has(item.key)) {
        missingInVi.push(`${item.key} (${item.file}:${item.line})`);
      }
    }

    expect(
      missingInEn,
      `Static t() keys called in code but missing from en.json:\n${missingInEn.join('\n')}`
    ).toEqual([]);

    expect(
      missingInVi,
      `Static t() keys called in code but missing from vi.json:\n${missingInVi.join('\n')}`
    ).toEqual([]);
  });

  it('3. en.json values do not contain non-diacritic Vietnamese stopwords', () => {
    const flattenedEn = flattenDictionary(enRaw);
    const vnStopwords = [
      'khong',
      'cua',
      'chu nha',
      'dat phong',
      'thanh toan',
      'vui long',
      'nguoi dung'
    ];

    // Valid allowed exceptions documented here (none needed currently)
    const allowedExceptions = new Set<string>();

    const violations: { key: string; word: string; text: string }[] = [];

    for (const [key, value] of Object.entries(flattenedEn)) {
      if (typeof value !== 'string') continue;
      if (allowedExceptions.has(key)) continue;

      const lower = value.toLowerCase();
      for (const word of vnStopwords) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lower)) {
          violations.push({ key, word, text: value });
        }
      }
    }

    expect(
      violations,
      `Found non-diacritic Vietnamese stopwords in en.json:\n${violations.map(v => `${v.key}: matched "${v.word}" in "${v.text}"`).join('\n')}`
    ).toEqual([]);
  });
});
