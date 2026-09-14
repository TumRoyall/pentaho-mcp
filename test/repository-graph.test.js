import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { createRepositoryPaths } from '../src/repository/paths.js';
import { scanRepository, dependencyClosure } from '../src/repository/graph.js';

test('scanRepository and dependencyClosure handle cycles and missing targets', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-graph-test-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    // Set up directory structure
    mkdirSync(path.join(root, 'sub'), { recursive: true });

    // Job A calls Trans B
    const jobAXml = `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>job_a</name>
  <entries>
    <entry>
      <name>Call B</name>
      <type>TRANS</type>
      <specification_method>rep_name</specification_method>
      <transname>trans_b</transname>
      <directory>/sub</directory>
    </entry>
  </entries>
</job>`;
    writeFileSync(path.join(root, 'job_a.kjb'), jobAXml, 'utf8');

    // Trans B calls Job A (cycle)
    const transBXml = `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>trans_b</name></info>
  <step>
    <name>Call A</name>
    <type>JobExecutor</type>
    <specification_method>rep_name</specification_method>
    <job_name>job_a</job_name>
    <directory_path>/</directory_path>
  </step>
</transformation>`;
    writeFileSync(path.join(root, 'sub', 'trans_b.ktr'), transBXml, 'utf8');

    // Trans C calls missing target
    const transCXml = `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>trans_c</name></info>
  <step>
    <name>Call Missing</name>
    <type>TransExecutor</type>
    <specification_method>rep_name</specification_method>
    <trans_name>missing</trans_name>
    <directory_path>/sub</directory_path>
  </step>
</transformation>`;
    writeFileSync(path.join(root, 'sub', 'trans_c.ktr'), transCXml, 'utf8');

    // 1. Scan Repository
    const scan = scanRepository(ctx);
    assert.equal(scan.artifacts.length, 3);
    assert.equal(scan.complete, true);
    assert.ok(scan.issues.some(i => i.code === 'MISSING_TARGET' && i.targetRepositoryPath === '/sub/missing'));

    // 2. Dependency Closure for Job A
    const aId = repositoryPaths.resolveArtifact({ repositoryPath: '/job_a', artifactKind: 'job' });
    const closure = dependencyClosure(scan, aId);
    assert.equal(closure.artifacts.length, 2); // job_a and trans_b
    assert.equal(closure.complete, true);
    assert.ok(closure.hasCycle);

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
