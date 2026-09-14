import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { createRepositoryPaths } from '../src/repository/paths.js';
import { planArtifactMove, planConnectionRename, planMigration } from '../src/repository/operations.js';

test('planArtifactMove moves artifact, updates internal name, and updates incoming references', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-ops-test-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    mkdirSync(path.join(root, 'sub'), { recursive: true });

    // Target transformation to move
    const transBXml = `<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>trans_b</name></info>
</transformation>`;
    writeFileSync(path.join(root, 'sub', 'trans_b.ktr'), transBXml, 'utf8');

    // Caller job referencing /sub/trans_b
    const jobAXml = `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>job_a</name>
  <entries>
    <entry>
      <name>START</name>
      <type>SPECIAL</type>
      <start>Y</start>
    </entry>
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

    // Move /sub/trans_b to /moved/trans_b_new
    const movePlan = planArtifactMove(ctx, {
      sourceRepositoryPath: '/sub/trans_b',
      sourceArtifactKind: 'trans',
      targetRepositoryPath: '/moved/trans_b_new',
      apply: true
    });

    assert.equal(movePlan.complete, true);
    assert.equal(movePlan.applied, true);

    // Verify incoming reference in job_a was updated
    const updatedJobXml = readFileSync(path.join(root, 'job_a.kjb'), 'utf8');
    assert.equal(updatedJobXml.includes('<transname>trans_b_new</transname>'), true);
    assert.equal(updatedJobXml.includes('<directory>/moved</directory>'), true);

    // Verify moved file internal name
    const movedTransXml = readFileSync(path.join(root, 'moved', 'trans_b_new.ktr'), 'utf8');
    assert.equal(movedTransXml.includes('<name>trans_b_new</name>'), true);

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('planConnectionRename renames .kdb connection and updates consumers', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-conn-rename-test-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    const kdbXml = `<?xml version="1.0" encoding="UTF-8"?>
<connection>
  <name>db_old</name>
  <server>localhost</server>
  <type>POSTGRESQL</type>
  <access>Native</access>
  <database>testdb</database>
  <port>5432</port>
  <username>postgres</username>
</connection>`;
    writeFileSync(path.join(root, 'db_old.kdb'), kdbXml, 'utf8');

    const jobXml = `<?xml version="1.0" encoding="UTF-8"?>
<job>
  <name>job_db</name>
  <entries>
    <entry>
      <name>START</name>
      <type>SPECIAL</type>
      <start>Y</start>
    </entry>
  </entries>
  <connection>
    <name>db_old</name>
    <server>localhost</server>
    <type>POSTGRESQL</type>
    <access>Native</access>
    <database>testdb</database>
    <port>5432</port>
    <username>postgres</username>
  </connection>
</job>`;
    writeFileSync(path.join(root, 'job_db.kjb'), jobXml, 'utf8');

    const renamePlan = planConnectionRename(ctx, {
      name: 'db_old',
      newName: 'db_new',
      apply: true
    });

    assert.equal(renamePlan.applied, true);

    // Verify file rename
    assert.equal(readFileSync(path.join(root, 'db_new.kdb'), 'utf8').includes('<name>db_new</name>'), true);

    // Verify consumer update
    const updatedJob = readFileSync(path.join(root, 'job_db.kjb'), 'utf8');
    assert.equal(updatedJob.includes('<name>db_new</name>'), true);

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
