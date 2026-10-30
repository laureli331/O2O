'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require(path.resolve(__dirname, '../../.local/sp01-shared-react18-probe/node_modules/typescript'));
const fs = require('node:fs');
const { checkSource, checkUiTypes, checkInferredAny } = require('./check-boundaries.cjs');
const root = path.resolve(__dirname, 'shared');
const inspect = text => checkSource(ts, path.join(root, 'fixture.ts'), text, root).map(x => x.code);

test('actual TypeScript parser accepts normal pure code, comments, strings and legitimate DTO fields', () => {
  for (const text of [
    'export interface State { count: number }; export const init: State = {count: 0}',
    'import type { CounterState } from "./contracts"; export type S = CounterState',
    'import {useReducer} from "react";',
    'export const text = "window wx any @ts-ignore"; // ordinary any word',
    'export const record = {document: "synthetic"}; export const value = record.document',
  ]) assert.deepEqual(inspect(text), []);
});

test('real type checker catches top-level inferred any that strict alone allows, while accepting unknown', () => {
  const directory = fs.mkdtempSync(path.resolve(__dirname, '../../.local/shared-any-check-'));
  const unsafe = path.join(directory, 'unsafe.ts');
  const safe = path.join(directory, 'safe.ts');
  fs.writeFileSync(unsafe, 'export const value = JSON.parse("{}"); export const items = [JSON.parse("{}")];');
  fs.writeFileSync(safe, 'export const value: unknown = JSON.parse("{}");');
  assert.equal(checkInferredAny(ts, [unsafe]).length, 2);
  assert.deepEqual(checkInferredAny(ts, [safe]), []);
});
test('actual parser rejects owned any, platform access, unsafe imports and type suppression', () => {
  for (const [text, code] of [
    ['export const state: any = 0', 'EXPLICIT_ANY'],
    ['export const state = 0 as any', 'EXPLICIT_ANY'],
    ['window.location.href', 'PLATFORM_GLOBAL'],
    ['const platform = wx; platform.request({})', 'PLATFORM_GLOBAL'],
    ['globalThis.document', 'PLATFORM_GLOBAL'],
    ['const scope = globalThis; scope.window', 'PLATFORM_GLOBAL'],
    ['import {View} from "@tarojs/components"', 'FORBIDDEN_MODULE'],
    ['import "../../apps/web/page"', 'FORBIDDEN_MODULE'],
    ['export * from "react-dom"', 'FORBIDDEN_MODULE'],
    ['import("../../apps/web/page")', 'FORBIDDEN_MODULE'],
    ['const name = "./x"; import(name)', 'DYNAMIC_MODULE_NOT_STATIC'],
    ['require("./contracts")', 'COMMONJS_REQUIRE'],
    ['// @ts-ignore\nexport const value = 0', 'TYPE_SUPPRESSION'],
    ['/* @ts-nocheck */\nexport const value = 0', 'TYPE_SUPPRESSION'],
  ]) assert.ok(inspect(text).includes(code), code);
});
test('UI allows platform access but cannot define its own interfaces, type aliases or any', () => {
  assert.deepEqual(checkUiTypes(ts, 'ui.tsx', 'const root = document.getElementById("root");'), []);
  for (const text of ['interface Props { id: string }', 'type Props = { id: string }', 'const value: any = 0']) {
    assert.ok(checkUiTypes(ts, 'ui.tsx', text).length > 0);
  }
});
test('actual shared sources and both UI shells satisfy the bounded architecture checks', () => {
  const { inspectDirectory } = require('./check-boundaries.cjs');
  const installedRoot = path.resolve(__dirname, '../../.local/sp01-shared-react18-probe/packages/shared/src');
  for (const file of fs.readdirSync(root)) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), fs.readFileSync(path.join(installedRoot, file), 'utf8'));
  }
  // Module/type resolution must use the installed workspace, not the dependency-free fixture folder.
  assert.deepEqual(inspectDirectory(ts, installedRoot), { files: 4, findings: [] });
  for (const name of ['web.tsx', 'miniapp.tsx']) {
    assert.deepEqual(checkUiTypes(ts, name, fs.readFileSync(path.join(__dirname, name), 'utf8')), []);
  }
});
