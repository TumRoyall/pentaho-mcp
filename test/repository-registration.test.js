import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { createRepositoryPaths } from '../src/repository/paths.js';
import { detectRepository, planRegistration, applyRegistration, parseRepositoriesXml } from '../src/repository/registration.js';

test('detectRepository identifies matched file repository by base_directory', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-reg-test-'));
  const kettleHome = mkdtempSync(path.join(tmpdir(), 'kettle-home-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    const kettleDir = path.join(kettleHome, '.kettle');
    mkdirSync(kettleDir, { recursive: true });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<repositories>
  <repository>
    <id>KettleFileRepository</id>
    <name>my_test_repo</name>
    <description>My Test Repo</description>
    <is_default>N</is_default>
    <type>KettleFileRepository</type>
    <base_directory>${root}</base_directory>
    <read_only>N</read_only>
  </repository>
</repositories>`;
    writeFileSync(path.join(kettleDir, 'repositories.xml'), xml, 'utf8');

    const result = detectRepository(ctx, {
      environment: { KETTLE_HOME: kettleHome },
      cwd: root
    });

    assert.equal(result.status, 'READY');
    assert.equal(result.repository.name, 'my_test_repo');
    assert.equal(result.repository.readOnly, false);

  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(kettleHome, { recursive: true, force: true });
  }
});

test('local cwd repositories.xml shadows user kettle home registry', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-local-test-'));
  const kettleHome = mkdtempSync(path.join(tmpdir(), 'kettle-home-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    // User home repo
    const kettleDir = path.join(kettleHome, '.kettle');
    mkdirSync(kettleDir, { recursive: true });
    writeFileSync(path.join(kettleDir, 'repositories.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<repositories>
  <repository>
    <name>user_home_repo</name>
    <type>KettleFileRepository</type>
    <base_directory>${root}</base_directory>
  </repository>
</repositories>`, 'utf8');

    // Local cwd repo (shadowing)
    writeFileSync(path.join(root, 'repositories.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<repositories>
  <repository>
    <name>local_shadow_repo</name>
    <type>KettleFileRepository</type>
    <base_directory>${root}</base_directory>
  </repository>
</repositories>`, 'utf8');

    const result = detectRepository(ctx, {
      environment: { KETTLE_HOME: kettleHome },
      cwd: root
    });

    assert.equal(result.status, 'READY');
    assert.equal(result.repository.name, 'local_shadow_repo');
    assert.equal(result.provenance, 'local');

  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(kettleHome, { recursive: true, force: true });
  }
});

test('planRegistration and applyRegistration explicitly register repository', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-plan-reg-test-'));
  const kettleHome = mkdtempSync(path.join(tmpdir(), 'kettle-home-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    const plan = planRegistration(ctx, {
      name: 'new_repo',
      environment: { KETTLE_HOME: kettleHome },
      cwd: root
    });

    assert.equal(plan.alreadyRegistered, false);
    assert.ok(plan.proposedXml.includes('<name>new_repo</name>'));
    assert.ok(plan.proposedXml.includes(`<base_directory>${root}</base_directory>`));

    const applyResult = applyRegistration(ctx, plan);
    assert.equal(applyResult.applied, true);

    const regFile = path.join(kettleHome, '.kettle', 'repositories.xml');
    const written = readFileSync(regFile, 'utf8');
    assert.ok(written.includes('<name>new_repo</name>'));

    // Re-registering is idempotent
    const plan2 = planRegistration(ctx, {
      name: 'new_repo',
      environment: { KETTLE_HOME: kettleHome },
      cwd: root
    });

    assert.equal(plan2.alreadyRegistered, true);

  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(kettleHome, { recursive: true, force: true });
  }
});

test('detectRepository flags mismatch when repositoryName points to different root', () => {
  const root1 = mkdtempSync(path.join(tmpdir(), 'repo-root1-'));
  const root2 = mkdtempSync(path.join(tmpdir(), 'repo-root2-'));
  const kettleHome = mkdtempSync(path.join(tmpdir(), 'kettle-home-'));
  try {
    const boundary = createWorkspaceBoundary(root1);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root: root1, repositoryName: 'target_repo' };

    const kettleDir = path.join(kettleHome, '.kettle');
    mkdirSync(kettleDir, { recursive: true });

    // Target repo points to root2, not root1
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<repositories>
  <repository>
    <name>target_repo</name>
    <type>KettleFileRepository</type>
    <base_directory>${root2}</base_directory>
  </repository>
</repositories>`;
    writeFileSync(path.join(kettleDir, 'repositories.xml'), xml, 'utf8');

    const result = detectRepository(ctx, {
      environment: { KETTLE_HOME: kettleHome },
      cwd: root1
    });

    assert.equal(result.status, 'MISMATCH');
    assert.ok(result.issues.some(i => i.includes('workspace root')));

  } finally {
    rmSync(root1, { recursive: true, force: true });
    rmSync(root2, { recursive: true, force: true });
    rmSync(kettleHome, { recursive: true, force: true });
  }
});
