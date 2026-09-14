import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { createRepositoryPaths } from '../src/repository/paths.js';

test('createRepositoryPaths resolves repository path and physical path correctly', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-paths-test-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repoPaths = createRepositoryPaths(boundary);

    // 1. Resolve repositoryPath with explicit kind
    mkdirSync(path.join(root, 'a'), { recursive: true });
    const id = repoPaths.resolveArtifact({ repositoryPath: '/a/check', artifactKind: 'trans' }, { write: true });
    assert.equal(id.physicalPath, path.join(root, 'a', 'check.ktr'));
    assert.equal(id.directory, '/a');
    assert.equal(id.name, 'check');
    assert.equal(id.artifactKind, 'trans');
    assert.equal(id.repositoryPath, '/a/check');

    // 2. Resolve root artifact
    const rootId = repoPaths.resolveArtifact({ repositoryPath: '/root_job', artifactKind: 'job' }, { write: true });
    assert.equal(rootId.physicalPath, path.join(root, 'root_job.kjb'));
    assert.equal(rootId.directory, '/');
    assert.equal(rootId.name, 'root_job');
    assert.equal(rootId.artifactKind, 'job');
    assert.equal(rootId.repositoryPath, '/root_job');

    // 3. Reject directory traversal
    assert.throws(
      () => repoPaths.resolveArtifact({ repositoryPath: '/../escape', artifactKind: 'job' }),
      /path|boundary|segment/i
    );

    // 4. Reject both path and repositoryPath provided together
    assert.throws(
      () => repoPaths.resolveArtifact({ path: 'a/check.ktr', repositoryPath: '/a/check' }),
      /mutually exclusive/i
    );

    // 5. Infer kind from single existing physical file
    writeFileSync(path.join(root, 'a', 'single.ktr'), '<transformation></transformation>');
    const inferred = repoPaths.resolveArtifact({ repositoryPath: '/a/single' });
    assert.equal(inferred.artifactKind, 'trans');
    assert.equal(inferred.physicalPath, path.join(root, 'a', 'single.ktr'));

    // 6. Fail kind inference on ambiguous files (both .ktr and .kjb exist)
    writeFileSync(path.join(root, 'a', 'single.kjb'), '<job></job>');
    assert.throws(
      () => repoPaths.resolveArtifact({ repositoryPath: '/a/single' }),
      (err) => err.code === 'AMBIGUOUS_ARTIFACT' || /ambiguous/i.test(err.message)
    );

    // 7. Fail on missing file when write is false and no artifactKind given
    assert.throws(
      () => repoPaths.resolveArtifact({ repositoryPath: '/a/nonexistent' }),
      (err) => err.code === 'ARTIFACT_NOT_FOUND' || /not found/i.test(err.message)
    );

    // 8. Resolve directory selector
    const dirRes = repoPaths.resolveDirectory({ repositoryDirectory: '/a/' });
    assert.equal(dirRes.repositoryDirectory, '/a');
    assert.equal(dirRes.physicalPath, path.join(root, 'a'));

    // 9. fromPhysical mapping
    const fromPhys = repoPaths.fromPhysical(path.join(root, 'a', 'single.ktr'));
    assert.equal(fromPhys.repositoryPath, '/a/single');
    assert.equal(fromPhys.artifactKind, 'trans');
    assert.equal(fromPhys.name, 'single');
    assert.equal(fromPhys.directory, '/a');

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
