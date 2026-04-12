import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('dist/js');
const knownExtPattern = /\.(mjs|cjs|js|json|node)$/;

const walkJsFiles = dir => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
};

const ensureJsExt = specifier => {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier;
  }
  if (knownExtPattern.test(specifier)) {
    return specifier;
  }
  return `${specifier}.js`;
};

const rewriteSpecifiers = code => {
  const importExportPattern =
    /(\b(?:import|export)\b[\s\S]*?\bfrom\s*['"])(\.{1,2}\/[^'"\n]+)(['"])/g;
  const dynamicImportPattern =
    /(\bimport\s*\(\s*['"])(\.{1,2}\/[^'"\n]+)(['"]\s*\))/g;

  let updated = code.replace(importExportPattern, (_m, head, spec, tail) => {
    return `${head}${ensureJsExt(spec)}${tail}`;
  });

  updated = updated.replace(dynamicImportPattern, (_m, head, spec, tail) => {
    return `${head}${ensureJsExt(spec)}${tail}`;
  });

  return updated;
};

const jsFiles = walkJsFiles(outputDir);
for (const filePath of jsFiles) {
  const original = fs.readFileSync(filePath, 'utf-8');
  const updated = rewriteSpecifiers(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf-8');
  }
}
