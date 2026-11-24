import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveWorkspaceRoot } from '../src/workspace/resolve-root.js';

let tmp;
let home;

function repoXml(repos) {
  const blocks = repos.map(r => `  <repository>
    <id>KettleFileRepository</id>
    <name>${r.name}</name>
    <description>${r.name}</description>
    <is_default>${r.isDefault ? 'true' : 'false'}</is_default>
    <base_directory>${r.base ?? ''}</base_directory>
    <read_only>N</read_only>
    <hides_hidden_files>N</hides_hidden_files>
  </repository>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<repositories>\n${blocks}\n</repositories>\n`;
}

function dir(...parts) {
  const p = path.join(tmp, ...parts);
  mkdirSync(p, { recursive: true });
  return p;
}

function writeKettleRegistry(repos) {
  mkdirSync(path.join(home, '.kettle'), { recursive: true });
  writeFileSync(path.join(home, '.kettle', 'repositories.xml'), repoXml(repos), 'utf8');
}

function resolve(cwd, extra = {}) {
  return resolveWorkspaceRoot({
    environment: { USERPROFILE: home, HOME: home, ...extra.environment },
    cwd,
    pentahoHome: extra.pentahoHome,
  });
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'kettle-root-')));
  home = dir('home');
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

test('a registered repository elsewhere does NOT hijack an unrelated working folder', () => {
  const foreign = dir('foreign-repo');
  writeKettleRegistry([{ name: 'foreign', base: foreign, isDefault: true }]);
  const project = dir('my-project');

  const r = resolve(project);
  assert.equal(r.root, project);
  assert.equal(r.mode, 'file');
  assert.equal(r.source, 'cwd');
});

test('opening the repository folder itself gives repository mode at that folder', () => {
  const repo = dir('ws', 'etl_repo');
  writeKettleRegistry([{ name: 'etl', base: repo }]);

  const r = resolve(repo);
  assert.equal(r.root, repo);
  assert.equal(r.mode, 'repository');
  assert.equal(r.source, 'kettle_home');
  assert.equal(r.match, 'cwd_inside_repository');
  assert.equal(r.repository.name, 'etl');
});

test('opening a sub-folder of a repository keeps the repository root (repo is not lost)', () => {
  const repo = dir('ws', 'etl_repo');
  const sub = dir('ws', 'etl_repo', 'batch', 'daily');
  writeKettleRegistry([{ name: 'etl', base: repo }]);

  const r = resolve(sub);
  assert.equal(r.root, repo);
  assert.equal(r.mode, 'repository');
  assert.equal(r.match, 'cwd_inside_repository');
});

test('opening a parent folder that contains exactly one repository uses that repository', () => {
  const parent = dir('ws');
  const repo = dir('ws', 'etl_repo');
  writeKettleRegistry([{ name: 'other', base: dir('elsewhere') }, { name: 'etl', base: repo }]);

  const r = resolve(parent);
  assert.equal(r.root, repo);
  assert.equal(r.mode, 'repository');
  assert.equal(r.match, 'repository_inside_cwd');
});

test('a parent folder holding several repositories prefers the default one among them', () => {
  const parent = dir('ws');
  const a = dir('ws', 'a');
  const b = dir('ws', 'b');
  writeKettleRegistry([{ name: 'a', base: a }, { name: 'b', base: b, isDefault: true }]);

  const r = resolve(parent);
  assert.equal(r.root, b);
  assert.equal(r.match, 'repository_inside_cwd');
});

test('a parent folder holding several non-default repositories stays in file mode at the folder', () => {
  const parent = dir('ws');
  writeKettleRegistry([{ name: 'a', base: dir('ws', 'a') }, { name: 'b', base: dir('ws', 'b') }]);

  const r = resolve(parent);
  assert.equal(r.root, parent);
  assert.equal(r.mode, 'file');
  assert.equal(r.source, 'cwd');
});

test('nested repositories: the deepest one containing the working folder wins', () => {
  const outer = dir('ws');
  const inner = dir('ws', 'inner');
  const work = dir('ws', 'inner', 'job');
  writeKettleRegistry([{ name: 'outer', base: outer, isDefault: true }, { name: 'inner', base: inner }]);

  assert.equal(resolve(work).root, inner);
});

test('repositories declared in PENTAHO_HOME/repositories.xml are matched too', () => {
  const pdi = dir('pdi');
  const repo = dir('ws', 'etl_repo');
  writeFileSync(path.join(pdi, 'repositories.xml'), repoXml([{ name: 'pdi_repo', base: repo }]), 'utf8');

  const r = resolve(repo, { pentahoHome: pdi });
  assert.equal(r.root, repo);
  assert.equal(r.source, 'pentaho_home');
});

test('a launch folder that is the user home falls back to the default repository', () => {
  const repo = dir('ws', 'etl_repo');
  writeKettleRegistry([{ name: 'etl', base: repo, isDefault: true }]);

  const r = resolve(home);
  assert.equal(r.root, repo);
  assert.equal(r.mode, 'repository');
  assert.equal(r.match, 'fallback_default');
});

test('repositories without a usable base_directory (e.g. database repos) are ignored', () => {
  const project = dir('my-project');
  writeKettleRegistry([{ name: 'repo_db', isDefault: true }, { name: 'missing', base: path.join(tmp, 'nope') }]);

  const r = resolve(project);
  assert.equal(r.root, project);
  assert.equal(r.mode, 'file');
});
