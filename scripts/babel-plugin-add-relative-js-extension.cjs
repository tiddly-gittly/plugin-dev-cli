const knownExtPattern = /\.(mjs|cjs|js|json|node)$/;

const shouldRewrite = source =>
  (source.startsWith('./') || source.startsWith('../')) &&
  !knownExtPattern.test(source);

const withJsExtension = source => `${source}.js`;

module.exports = function addRelativeJsExtensionPlugin() {
  return {
    name: 'add-relative-js-extension',
    visitor: {
      ImportDeclaration(path) {
        const source = path.node.source?.value;
        if (typeof source === 'string' && shouldRewrite(source)) {
          path.node.source.value = withJsExtension(source);
        }
      },
      ExportNamedDeclaration(path) {
        const source = path.node.source?.value;
        if (typeof source === 'string' && shouldRewrite(source)) {
          path.node.source.value = withJsExtension(source);
        }
      },
      ExportAllDeclaration(path) {
        const source = path.node.source?.value;
        if (typeof source === 'string' && shouldRewrite(source)) {
          path.node.source.value = withJsExtension(source);
        }
      },
      CallExpression(path) {
        if (path.node.callee.type !== 'Import') {
          return;
        }
        const firstArg = path.node.arguments[0];
        if (!firstArg || firstArg.type !== 'StringLiteral') {
          return;
        }
        if (shouldRewrite(firstArg.value)) {
          firstArg.value = withJsExtension(firstArg.value);
        }
      },
    },
  };
};
