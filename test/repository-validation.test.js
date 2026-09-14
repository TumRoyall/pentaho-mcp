import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { createRepositoryPaths } from '../src/repository/paths.js';
import { validateXml, validateRepositoryReadiness } from '../src/core/validate.js';
import { rewriteReference } from '../src/repository/references.js';

test('repository-aware validation validates repository targets and readiness', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-val-test-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    // Create target sub_trans.ktr
    const targetXml = `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>sub_trans</name></info>
</transformation>`;
    writeFileSync(path.join(root, 'sub_trans.ktr'), targetXml, 'utf8');

    // Create job calling sub_trans
    const jobXml = `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>main_job</name>
  <entries>
    <entry>
      <name>START</name>
      <type>SPECIAL</type>
      <start>Y</start>
    </entry>
    <entry>
      <name>Run Sub Trans</name>
      <type>TRANS</type>
      <specification_method>rep_name</specification_method>
      <trans_object_id/>
      <filename/>
      <transname>sub_trans</transname>
      <directory>/</directory>
    </entry>
  </entries>
  <hops>
    <hop>
      <from>START</from>
      <to>Run Sub Trans</to>
      <enabled>Y</enabled>
    </hop>
  </hops>
</job>`;
    const mainJobPath = path.join(root, 'main_job.kjb');
    writeFileSync(mainJobPath, jobXml, 'utf8');

    // 1. Valid repo reference produces no missing-filename warning
    const valReport = validateXml(jobXml, mainJobPath, { dir: root, repositoryContext: ctx });
    assert.equal(valReport.summary.errors, 0);

    // 2. Candidate edit introducing dangling reference
    const mainJobId = repositoryPaths.resolveArtifact({ repositoryPath: '/main_job', artifactKind: 'job' });
    const invalidTarget = {
      repositoryPath: '/nonexistent_trans',
      artifactKind: 'trans',
      name: 'nonexistent_trans',
      directory: '/'
    };

    const invalidXml = rewriteReference(jobXml, { ownerKind: 'job', elementName: 'Run Sub Trans', target: invalidTarget });
    const invalidReport = validateXml(invalidXml, mainJobPath, { dir: root, repositoryContext: ctx });
    assert.ok(invalidReport.issues.some(i => i.severity === 'error' && /missing/i.test(i.message)));

    // 3. Byte identity assertion on rejected changes
    const beforeContent = readFileSync(mainJobPath, 'utf8');
    assert.throws(() => {
      // Simulate failed edit handler
      const report = validateXml(invalidXml, mainJobPath, { dir: root, repositoryContext: ctx });
      if (report.summary.errors > 0) {
        throw new Error(`Validation failed: ${report.issues[0].message}`);
      }
      writeFileSync(mainJobPath, invalidXml, 'utf8');
    }, /Validation failed/i);

    assert.equal(readFileSync(mainJobPath, 'utf8'), beforeContent);

    // 4. Test readiness check
    const readiness = validateRepositoryReadiness(ctx, mainJobId);
    assert.equal(readiness.ready, true);

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
