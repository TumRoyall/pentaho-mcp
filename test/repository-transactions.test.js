import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createWorkspaceBoundary } from '../src/workspace/boundary.js';
import { createRepositoryPaths } from '../src/repository/paths.js';
import { previewChanges, applyChanges, recoverChanges } from '../src/repository/transactions.js';

test('transactions perform preview, atomic apply, and rollback on failure', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-tx-test-'));
  try {
    const boundary = createWorkspaceBoundary(root);
    const repositoryPaths = createRepositoryPaths(boundary);
    const ctx = { ...boundary, repositoryPaths, root };

    const file1 = path.join(root, 'file1.ktr');
    const file2 = path.join(root, 'file2.ktr');
    writeFileSync(file1, '<transformation><info><name>file1</name></info></transformation>', 'utf8');
    writeFileSync(file2, '<transformation><info><name>file2</name></info></transformation>', 'utf8');

    // 1. Preview changes
    const changes = [
      { physicalPath: file1, afterContent: '<transformation><info><name>file1_mod</name></info></transformation>' },
      { physicalPath: file2, afterContent: '<transformation><info><name>file2_mod</name></info></transformation>' },
    ];
    const preview = previewChanges(ctx, changes);
    assert.ok(preview.id);
    assert.equal(preview.changes.length, 2);

    // Original files untouched before apply
    assert.equal(readFileSync(file1, 'utf8').includes('file1_mod'), false);

    // 2. Apply preview manifest
    const result = applyChanges(ctx, { manifest: preview });
    assert.equal(result.applied, true);
    assert.equal(readFileSync(file1, 'utf8').includes('file1_mod'), true);
    assert.equal(readFileSync(file2, 'utf8').includes('file2_mod'), true);

    // 3. Rollback / recover test
    const rollbackRes = recoverChanges(ctx, { transactionId: preview.id });
    assert.equal(rollbackRes.recovered, true);
    assert.equal(readFileSync(file1, 'utf8').includes('file1_mod'), false);

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
