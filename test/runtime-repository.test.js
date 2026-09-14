import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildRepositoryArgs, classifyLoadcheck, runPdi } from '../src/runtime/run.js';

test('buildRepositoryArgs produces exact repository arguments without /norep or /file', () => {
  const args = buildRepositoryArgs({
    identity: { artifactKind: 'job', directory: '/batch/job', name: 'demo' },
    repositoryName: 'fixture_repo',
    mode: 'execute',
    parameters: { PRD_ID: '20260911' },
    logLevel: 'Detailed'
  });

  assert.ok(args.includes('/rep:fixture_repo'));
  assert.ok(args.includes('/dir:/batch/job'));
  assert.ok(args.includes('/job:demo'));
  assert.ok(args.includes('/level:Detailed'));
  assert.ok(args.includes('/param:PRD_ID=20260911'));
  assert.equal(args.some(x => x === '/norep' || x.startsWith('/file:')), false);
});

test('classifyLoadcheck distinguishes PASS, FAIL, and INDETERMINATE for exit code 7', () => {
  assert.equal(classifyLoadcheck({ exitCode: 0, stdout: 'Done' }), 'PASS');

  // Exit code 7 with parameter listing evidence -> PASS
  const passLogs = `INFO 11-09 10:00:00 - Kitchen - Parameter: PRD_ID = 20260911`;
  assert.equal(classifyLoadcheck({ exitCode: 7, stdout: passLogs }), 'PASS');

  // Exit code 7 with load failure error -> FAIL
  const failLogs = `ERROR 11-09 10:00:00 - Kitchen - Unable to load job [demo] in directory [/batch/job]`;
  assert.equal(classifyLoadcheck({ exitCode: 7, stderr: failLogs }), 'FAIL');

  // Exit code 7 with zero parameter evidence and no failure message -> INDETERMINATE
  const ambiguousLogs = `INFO 11-09 10:00:00 - Kitchen - Logging started`;
  assert.equal(classifyLoadcheck({ exitCode: 7, stdout: ambiguousLogs }), 'INDETERMINATE');

  // Non-zero non-7 exit code -> FAIL
  assert.equal(classifyLoadcheck({ exitCode: 1, stdout: 'Error' }), 'FAIL');
});

test('runPdi returns REPOSITORY_NOT_READY if repository registration is missing or mismatched', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-run-test-'));
  const home = mkdtempSync(path.join(tmpdir(), 'pentaho-home-'));
  try {
    writeFileSync(path.join(home, 'Kitchen.bat'), '@echo off', 'utf8');
    writeFileSync(path.join(home, 'Pan.bat'), '@echo off', 'utf8');

    const jobXml = `<?xml version="1.0" encoding="UTF-8"?><job><name>test</name><entries><entry><name>START</name><type>SPECIAL</type><start>Y</start></entry></entries></job>`;
    writeFileSync(path.join(root, 'test.kjb'), jobXml, 'utf8');

    const res = await runPdi({
      artifact: path.join(root, 'test.kjb'),
      mode: 'loadcheck',
      kind: 'job'
    }, {
      root,
      pentahoHome: home,
      repository: { status: 'UNREGISTERED', issues: ['No repo registered'] }
    });

    assert.equal(res.status, 'REPOSITORY_NOT_READY');
    assert.equal(res.repositoryStatus, 'UNREGISTERED');

  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
