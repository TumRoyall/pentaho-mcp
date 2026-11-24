/**
 * Header <directory> and job/trans references follow the workspace mode,
 * matching what Spoon writes (see test/test_repo vs test/test_norepo):
 *
 *   repository mode: <directory> = repository folder of the file, e.g.
 *                    /batch/daily/job; references use rep_name + directory.
 *   file mode:       <directory>/</directory>; references use
 *                    specification_method=filename + absolute <filename>.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { makeContext } from '../src/server.js';
import { buildTools } from '../src/tools/registry.js';

let tmp;
beforeEach(() => { tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'kettle-repodir-'))); });
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function tools(workspaceMode) {
  const ctx = makeContext({ root: tmp, workspaceMode, pentahoHome: '' });
  const byName = new Map(buildTools(ctx).map(t => [t.name, t]));
  return name => args => byName.get(name).handler(args);
}

/** The artifact-level <directory> (job header / trans <info>), not entry tags. */
function headerDirectory(xml, kind) {
  const region = kind === 'job'
    ? xml.slice(0, xml.indexOf('<entries>'))
    : xml.slice(xml.indexOf('<info>'), xml.indexOf('</info>'));
  const m = /<directory>([\s\S]*?)<\/directory>|<directory\/>/.exec(region);
  return m ? (m[1] ?? '') : null;
}

function entryBlock(xml, name) {
  const re = new RegExp(`<entry>\\s*<name>${name}</name>[\\s\\S]*?</entry>`);
  return re.exec(xml)?.[0] ?? '';
}

test('repository mode: created job/trans carry their repository folder as <directory>', () => {
  const call = tools('repository');
  call('kettle_create_file')({ path: 'batch/daily/job/etl_job.kjb' });
  call('kettle_create_file')({ path: 'batch/daily/trans/etl_trans.ktr' });

  const job = readFileSync(path.join(tmp, 'batch/daily/job/etl_job.kjb'), 'utf8');
  const trans = readFileSync(path.join(tmp, 'batch/daily/trans/etl_trans.ktr'), 'utf8');
  assert.equal(headerDirectory(job, 'job'), '/batch/daily/job');
  assert.equal(headerDirectory(trans, 'trans'), '/batch/daily/trans');
});

test('repository mode: a file at the repository root gets <directory>/</directory>', () => {
  tools('repository')('kettle_create_file')({ path: 'top.kjb' });
  assert.equal(headerDirectory(readFileSync(path.join(tmp, 'top.kjb'), 'utf8'), 'job'), '/');
});

test('file mode: created job/trans always carry <directory>/</directory>', () => {
  const call = tools('file');
  call('kettle_create_file')({ path: 'batch/daily/job/etl_job.kjb' });
  call('kettle_create_file')({ path: 'batch/daily/trans/etl_trans.ktr' });

  assert.equal(headerDirectory(readFileSync(path.join(tmp, 'batch/daily/job/etl_job.kjb'), 'utf8'), 'job'), '/');
  assert.equal(headerDirectory(readFileSync(path.join(tmp, 'batch/daily/trans/etl_trans.ktr'), 'utf8'), 'trans'), '/');
});

test('created files with <directory> still validate clean', () => {
  const res = tools('repository')('kettle_create_file')({ path: 'batch/job/x.kjb' });
  assert.equal(res.validation.summary.errors, 0);
});

test('clone rewrites the header <directory> for the destination folder but not entry references', () => {
  const call = tools('repository');
  call('kettle_create_file')({ path: 'batch/daily/trans/t.ktr' });
  call('kettle_create_file')({ path: 'batch/daily/job/src.kjb' });
  call('kettle_add_element')({ path: 'batch/daily/job/src.kjb', type: 'TRANS', name: 'Run T' });
  call('kettle_set_reference')({ path: 'batch/daily/job/src.kjb', elementName: 'Run T', targetRepositoryPath: '/batch/daily/trans/t' });

  call('kettle_clone')({ sourcePath: 'batch/daily/job/src.kjb', destPath: 'batch/monthly/job/copy.kjb', name: 'copy' });
  const copy = readFileSync(path.join(tmp, 'batch/monthly/job/copy.kjb'), 'utf8');
  assert.equal(headerDirectory(copy, 'job'), '/batch/monthly/job');
  assert.match(entryBlock(copy, 'Run T'), /<directory>\/batch\/daily\/trans<\/directory>/);
});

test('repository mode: a job -> trans reference uses rep_name + repository directory', () => {
  const call = tools('repository');
  call('kettle_create_file')({ path: 'batch/daily/trans/etl_trans.ktr' });
  call('kettle_create_file')({ path: 'batch/daily/job/etl_job.kjb' });
  call('kettle_add_element')({ path: 'batch/daily/job/etl_job.kjb', type: 'TRANS', name: 'Transformation' });
  const res = call('kettle_set_reference')({
    path: 'batch/daily/job/etl_job.kjb', elementName: 'Transformation', targetRepositoryPath: '/batch/daily/trans/etl_trans',
  });

  const entry = entryBlock(readFileSync(path.join(tmp, 'batch/daily/job/etl_job.kjb'), 'utf8'), 'Transformation');
  assert.match(entry, /<specification_method>rep_name<\/specification_method>/);
  assert.match(entry, /<transname>etl_trans<\/transname>/);
  assert.match(entry, /<directory>\/batch\/daily\/trans<\/directory>/);
  assert.match(entry, /<filename\/>/);
  assert.equal(res.status, 'MANAGED_REPO_REFERENCE');
});

test('file mode: a job -> trans reference uses filename with the absolute path', () => {
  const call = tools('file');
  call('kettle_create_file')({ path: 'etl_trans.ktr' });
  call('kettle_create_file')({ path: 'etl_job.kjb' });
  call('kettle_add_element')({ path: 'etl_job.kjb', type: 'TRANS', name: 'Transformation' });
  const res = call('kettle_set_reference')({
    path: 'etl_job.kjb', elementName: 'Transformation', targetRepositoryPath: '/etl_trans',
  });

  const entry = entryBlock(readFileSync(path.join(tmp, 'etl_job.kjb'), 'utf8'), 'Transformation');
  const abs = path.join(tmp, 'etl_trans.ktr');
  assert.match(entry, /<specification_method>filename<\/specification_method>/);
  assert.ok(entry.includes(`<filename>${abs}</filename>`), entry);
  assert.doesNotMatch(entry, /<transname>[^<]+<\/transname>/);
  assert.equal(res.status, 'FILE_REFERENCE');
});
