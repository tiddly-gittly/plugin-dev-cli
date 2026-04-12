const fs = require('fs');
const path = require('path');

const distJsDir = path.resolve(__dirname, '../dist/js');
const knownExtPattern = /\.(mjs|cjs|js|json|node)$/;

const shouldRewrite = source =>
  (source.startsWith('./') || source.startsWith('../')) &&
  !knownExtPattern.test(source);

const addJsExtension = source => (shouldRewrite(source) ? `${source}.js` : source);

const rewriteSource = source =>
  source
    .replace(
      /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
      (_match, prefix, importPath, suffix) => `${prefix}${addJsExtension(importPath)}${suffix}`,
    )
    .replace(
      /(import\s*\(\s*['"])(\.\.?\/[^'"]+)(['"]\s*\))/g,
      (_match, prefix, importPath, suffix) => `${prefix}${addJsExtension(importPath)}${suffix}`,
    );

const walkFiles = dir => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
};

for (const filePath of walkFiles(distJsDir)) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = rewriteSource(source);

  if (transformed !== source) {
    fs.writeFileSync(filePath, transformed, 'utf8');
  }
}
