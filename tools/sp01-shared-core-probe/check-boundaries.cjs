'use strict';
const fs = require('node:fs');
const path = require('node:path');
const GLOBALS = new Set(['window', 'document', 'wx', 'globalThis', 'self', 'navigator', 'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest']);
function within(root, file) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function allowedImport(specifier, file, sharedRoot) {
  return specifier === 'react' || (specifier.startsWith('.') && within(sharedRoot, path.resolve(path.dirname(file), specifier)));
}
function checkSource(ts, file, text, sharedRoot) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings = [];
  const add = (code, node) => findings.push({ code, file: path.basename(file), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  let token;
  while ((token = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if ([ts.SyntaxKind.SingleLineCommentTrivia, ts.SyntaxKind.MultiLineCommentTrivia].includes(token)
      && /@ts-(ignore|nocheck|expect-error)\b/.test(scanner.getTokenText())) findings.push({ code: 'TYPE_SUPPRESSION', file: path.basename(file) });
  }
  function checkModule(node, argument) {
    if (!argument || !ts.isStringLiteralLike(argument)) return add('DYNAMIC_MODULE_NOT_STATIC', node);
    if (!allowedImport(argument.text, file, sharedRoot)) add('FORBIDDEN_MODULE', node);
  }
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) add('EXPLICIT_ANY', node);
    if (ts.isImportDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier)) checkModule(node, node.moduleSpecifier);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) checkModule(node, node.arguments[0]);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') add('COMMONJS_REQUIRE', node);
    if (ts.isIdentifier(node) && GLOBALS.has(node.text)) {
      const parent = node.parent;
      const propertyOnly = (ts.isPropertyAccessExpression(parent) && parent.name === node)
        || ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node);
      if (!propertyOnly) add('PLATFORM_GLOBAL', node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}
function collect(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw Error('SHARED_SOURCE_SYMLINK_NOT_ALLOWED');
    if (entry.isDirectory()) files.push(...collect(file));
    else if (/\.[cm]?tsx?$/.test(entry.name)) files.push(file);
  }
  return files;
}
function inspectDirectory(ts, sharedRoot) {
  const files = collect(sharedRoot);
  if (!files.length) throw Error('NO_SHARED_SOURCE_FILES');
  return { files: files.length, findings: [...files.flatMap(file => checkSource(ts, file, fs.readFileSync(file, 'utf8'), sharedRoot)),
    ...checkInferredAny(ts, files)] };
}
function checkInferredAny(ts, files) {
  const program = ts.createProgram(files, { strict: true, types: [], lib: ['lib.es2020.d.ts'],
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noEmit: true });
  const checker = program.getTypeChecker();
  const findings = [];
  const isAny = type => Boolean(type.flags & ts.TypeFlags.Any)
    || (checker.isArrayType(type) && isAny(checker.getTypeArguments(type)[0]));
  for (const file of files) {
    const source = program.getSourceFile(file);
    function visit(node) {
      if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node))
          && ts.isIdentifier(node.name) && isAny(checker.getTypeAtLocation(node.name))) {
        findings.push({ code: 'INFERRED_ANY', file: path.basename(file), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return findings;
}
function checkUiTypes(ts, file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  function visit(node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) findings.push({ code: 'OWNED_TYPE_OUTSIDE_SHARED', file: path.basename(file) });
    if (node.kind === ts.SyntaxKind.AnyKeyword) findings.push({ code: 'EXPLICIT_ANY', file: path.basename(file) });
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}
module.exports = { within, allowedImport, checkSource, checkUiTypes, checkInferredAny, inspectDirectory };
if (require.main === module) {
  const [compilerPath, sharedRoot] = process.argv.slice(2);
  if (!compilerPath || !sharedRoot) throw Error('EXPECTED_TYPESCRIPT_AND_SHARED_PATHS');
  const result = inspectDirectory(require(path.resolve(compilerPath)), path.resolve(sharedRoot));
  console.log(JSON.stringify(result));
  if (result.findings.length) process.exitCode = 1;
}
