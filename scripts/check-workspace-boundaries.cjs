'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(process.argv[2] ?? path.resolve(__dirname, '..'));
const problems = [];
const allowedWorkspaces = ['apps/*', 'packages/*'];
const forbiddenPathSegments = new Set([
  '.local',
  'miniprogram',
  'previews',
  'redbook',
  'tests',
  'tools',
]);
const ownedSourceRoots = [
  'apps/mini-program/src',
  'apps/admin-web/src',
  'packages/shared/src',
];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);
const appWorkspaceNames = new Set(['@xianglin/admin-web', '@xianglin/mini-program', '@xianglin/cloud-functions']);

function readJson(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    problems.push(`${relativePath}: cannot read valid JSON (${error.message})`);
    return {};
  }
}

function exists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function isWithin(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function sourceFiles(relativeRoot) {
  const absoluteRoot = path.join(projectRoot, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) {
    problems.push(`${relativeRoot}: approved source root is missing`);
    return [];
  }
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isSymbolicLink()) {
        problems.push(`${path.relative(projectRoot, fullPath)}: symlinks are not allowed in authored source roots`);
      }
      else if (sourceExtensions.has(path.extname(entry.name))) files.push(fullPath);
    }
  };
  visit(absoluteRoot);
  return files;
}

function checkWorkspaceShape() {
  const manifest = readJson('package.json');
  if (JSON.stringify(manifest.workspaces) !== JSON.stringify(allowedWorkspaces)) {
    problems.push(`package.json: workspaces must stay ${JSON.stringify(allowedWorkspaces)} so QuickStart is excluded`);
  }
  const tsconfig = readJson('tsconfig.json');
  if (tsconfig.compilerOptions?.strict !== true) {
    problems.push('tsconfig.json: strict must be true');
  }

  const miniManifest = readJson('apps/mini-program/package.json');
  const miniBuild = miniManifest.scripts?.build ?? '';
  if (
    !miniBuild.includes('check:boundaries')
    || !miniBuild.includes('taro build')
    || miniBuild.indexOf('check:boundaries') > miniBuild.indexOf('taro build')
  ) {
    problems.push('apps/mini-program/package.json: build must run the boundary gate before Taro build');
  }
  const miniConfig = exists('apps/mini-program/config/index.ts')
    ? fs.readFileSync(path.join(projectRoot, 'apps/mini-program/config/index.ts'), 'utf8')
    : '';
  if (!/sourceRoot\s*:\s*['"]src['"]/.test(miniConfig) || !/outputRoot\s*:\s*['"]dist['"]/.test(miniConfig)) {
    problems.push('apps/mini-program/config/index.ts: build roots must remain src → dist');
  }

  const webManifest = readJson('apps/admin-web/package.json');
  const webBuild = webManifest.scripts?.build ?? '';
  if (
    !webBuild.includes('check:boundaries')
    || !webBuild.includes('vite build')
    || webBuild.indexOf('check:boundaries') > webBuild.indexOf('vite build')
  ) {
    problems.push('apps/admin-web/package.json: build must run the boundary gate before Vite build');
  }
  if (!exists('apps/admin-web/vite.config.ts')) {
    problems.push('apps/admin-web/vite.config.ts: formal web build configuration is missing');
  }

  const cloudManifest = readJson('apps/cloud-functions/package.json');
  if (Object.keys(cloudManifest.scripts ?? {}).some((name) => /deploy|publish/i.test(name))) {
    problems.push('cloud workspace must not expose a deploy/publish script in SP07');
  }
  const cloudDependencies = {
    ...cloudManifest.dependencies,
    ...cloudManifest.devDependencies,
  };
  if (Object.keys(cloudDependencies).some((name) => /wx-server-sdk|cloudbase|tencentcloud/i.test(name))) {
    problems.push('cloud workspace must not include a live cloud SDK in SP07');
  }

  const lockPath = path.join(projectRoot, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = readJson('package-lock.json');
    if (JSON.stringify(lock.packages?.['']?.workspaces) !== JSON.stringify(allowedWorkspaces)) {
      problems.push('package-lock.json: root workspace map must match package.json');
    }
    for (const packagePath of Object.keys(lock.packages ?? {})) {
      if (packagePath.split(/[\\/]/).includes('miniprogram')) {
        problems.push(`package-lock.json: QuickStart path entered the workspace lock (${packagePath})`);
      }
    }
  }
}

function importSpecifiers(sourceFile) {
  const specifiers = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node)
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

function inspectSourceFile(filePath, relativeRoot) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativeFile = path.relative(projectRoot, filePath);
  const scriptKind = /\.(?:tsx|jsx)$/.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, scriptKind, content);
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    const token = scanner.getToken();
    if (
      (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia)
      && /@ts-(?:ignore|nocheck|expect-error)\b/.test(scanner.getTokenText())
    ) {
      problems.push(`${relativeFile}: TypeScript suppression directives are not allowed in authored source`);
    }
  }
  const shared = relativeRoot === 'packages/shared/src';
  const allowedRelativeRoots = shared
    ? [path.join(projectRoot, 'packages/shared/src')]
    : [path.join(projectRoot, relativeRoot), path.join(projectRoot, 'packages/shared/src')];

  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      problems.push(`${relativeFile}: explicit any is not allowed`);
    }
    if (
      shared
      && ts.isIdentifier(node)
      && ['window', 'document', 'wx'].includes(node.text)
      && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
      && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)
    ) {
      problems.push(`${relativeFile}: shared source references platform global ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  for (const specifier of importSpecifiers(source)) {
    if (!specifier.startsWith('.')) {
      if (shared && /^@xianglin\/(?:admin-web|mini-program|cloud-functions)\b/.test(specifier)) {
        problems.push(`${relativeFile}: shared source may not depend on an app workspace (${specifier})`);
      }
      if (!shared && [...appWorkspaceNames].some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
        problems.push(`${relativeFile}: app source may not depend on another app workspace (${specifier})`);
      }
      continue;
    }
    const target = path.resolve(path.dirname(filePath), specifier);
    const approved = allowedRelativeRoots.some((allowedRoot) => isWithin(allowedRoot, target));
    const targetSegments = path.relative(projectRoot, target).split(path.sep);
    const forbidden = targetSegments.some((segment) => forbiddenPathSegments.has(segment));
    if (!approved || forbidden) {
      problems.push(`${relativeFile}: relative import ${specifier} resolves outside the approved source roots`);
    }
  }
}

function checkSources() {
  for (const relativeRoot of ownedSourceRoots) {
    for (const file of sourceFiles(relativeRoot)) inspectSourceFile(file, relativeRoot);
  }
}

function main() {
  if (!fs.existsSync(projectRoot)) {
    console.error(`Workspace root does not exist: ${projectRoot}`);
    process.exitCode = 1;
    return;
  }

  checkWorkspaceShape();
  checkSources();

  if (problems.length > 0) {
    console.error(problems.map((problem) => `- ${problem}`).join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Workspace boundary checks passed.');
}

main();
