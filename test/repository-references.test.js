import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractReferences, rewriteReference } from '../src/repository/references.js';

test('extractReferences extracts references for all evidence adapters', () => {
  const readFix = (name) => readFileSync(new URL(`./fixtures/file-repository/${name}`, import.meta.url), 'utf8');

  // JOB entry JOB
  const jobJobXml = readFix('job_entry_job.kjb');
  const refs1 = extractReferences(jobJobXml, { artifactKind: 'job', repositoryPath: '/test_job' });
  assert.equal(refs1.length, 1);
  assert.equal(refs1[0].elementName, 'Run Sub Job');
  assert.equal(refs1[0].ownerType, 'JOB');
  assert.equal(refs1[0].targetKind, 'job');
  assert.equal(refs1[0].targetRepositoryPath, '/batch/sub_job');

  // JOB entry TRANS
  const jobTransXml = readFix('job_entry_trans.kjb');
  const refs2 = extractReferences(jobTransXml, { artifactKind: 'job', repositoryPath: '/test_job' });
  assert.equal(refs2.length, 1);
  assert.equal(refs2[0].ownerType, 'TRANS');
  assert.equal(refs2[0].targetKind, 'trans');
  assert.equal(refs2[0].targetRepositoryPath, '/batch/sub_trans');

  // Trans JobExecutor
  const transJobXml = readFix('trans_job_executor.ktr');
  const refs3 = extractReferences(transJobXml, { artifactKind: 'trans', repositoryPath: '/test_trans' });
  assert.equal(refs3[0].ownerType, 'JobExecutor');
  assert.equal(refs3[0].targetKind, 'job');
  assert.equal(refs3[0].targetRepositoryPath, '/batch/sub_job');

  // Trans TransExecutor
  const transTransXml = readFix('trans_trans_executor.ktr');
  const refs4 = extractReferences(transTransXml, { artifactKind: 'trans', repositoryPath: '/test_trans' });
  assert.equal(refs4[0].ownerType, 'TransExecutor');
  assert.equal(refs4[0].targetKind, 'trans');
  assert.equal(refs4[0].targetRepositoryPath, '/batch/sub_trans');

  // Trans Mapping
  const mappingXml = readFix('trans_mapping.ktr');
  const refs5 = extractReferences(mappingXml, { artifactKind: 'trans', repositoryPath: '/test_trans' });
  assert.equal(refs5[0].ownerType, 'Mapping');
  assert.equal(refs5[0].targetKind, 'trans');
  assert.equal(refs5[0].targetRepositoryPath, '/mapping/sub_mapping');

  // Trans SimpleMapping
  const simpleXml = readFix('trans_simple_mapping.ktr');
  const refs6 = extractReferences(simpleXml, { artifactKind: 'trans', repositoryPath: '/test_trans' });
  assert.equal(refs6[0].ownerType, 'SimpleMapping');
  assert.equal(refs6[0].targetKind, 'trans');
  assert.equal(refs6[0].targetRepositoryPath, '/mapping/simple_sub');

  // Trans SingleThreader
  const singleXml = readFix('trans_single_threader.ktr');
  const refs7 = extractReferences(singleXml, { artifactKind: 'trans', repositoryPath: '/test_trans' });
  assert.equal(refs7[0].ownerType, 'SingleThreader');
  assert.equal(refs7[0].targetKind, 'trans');
  assert.equal(refs7[0].targetRepositoryPath, '/batch/single_sub');

  // Trans MetaInject
  const injectXml = readFix('trans_meta_inject.ktr');
  const refs8 = extractReferences(injectXml, { artifactKind: 'trans', repositoryPath: '/test_trans' });
  assert.equal(refs8[0].ownerType, 'MetaInject');
  assert.equal(refs8[0].targetKind, 'trans');
  assert.equal(refs8[0].targetRepositoryPath, '/inject/inject_target');
});

test('rewriteReference performs surgical edit and is idempotent', () => {
  const readFix = (name) => readFileSync(new URL(`./fixtures/file-repository/${name}`, import.meta.url), 'utf8');
  const before = readFix('job_entry_trans.kjb');

  const target = {
    repositoryPath: '/xuat_user_active/check',
    artifactKind: 'trans',
    name: 'check',
    directory: '/xuat_user_active'
  };

  const after = rewriteReference(before, { ownerKind: 'job', elementName: 'Run Trans', target });
  const [ref] = extractReferences(after, { artifactKind: 'job', repositoryPath: '/job' });
  assert.equal(ref.targetRepositoryPath, '/xuat_user_active/check');
  assert.equal(ref.targetKind, 'trans');
  assert.equal(ref.elementName, 'Run Trans');

  // Idempotence test
  const twice = rewriteReference(after, { ownerKind: 'job', elementName: 'Run Trans', target });
  assert.equal(twice, after);
});
