# Pentaho File Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:subagent-driven-development only if the user requests delegation. Steps use checkbox syntax for tracking.

**Goal:** Implement repository-native artifact paths, executable references, .kdb management and repository-aware PDI test execution.

**Architecture:** Keep the existing physical workspace boundary, add a typed repository layer above it, and share reference/connection resolution across tools, validation and runtime. Reuse surgical XML editing. Previewed multi-file operations share a recoverable transaction service; PDI registration is a separate narrowly scoped configuration operation.

**Tech Stack:** Node.js >=20, JavaScript ESM, node:test, existing MCP SDK and fast-xml-parser, Windows PDI 9.4.

**Spec:** `docs/superpowers/specs/2026-09-11-file-repository-design.md` (read in full before execution).

**Source evidence:** Read `docs/pdi94-repository-evidence.md` first. It now exists from local source review at Pentaho `1a939ab5cabe4517867879684aeca2a526bcc638` (9.4.0.0-SNAPSHOT); extend it with fixtures/runtime results, do not replace it with a claim that all evidence is missing or all behavior is runtime-verified.

## Global constraints

- Node.js >=20; JavaScript ESM; keep existing MCP SDK and fast-xml-parser; no new runtime dependency without a documented need.
- Primary target: Windows and PDI 9.4; portable unit tests must also pass where supported.
- All artifact and connection reads/writes remain inside canonical KETTLE_ROOT, including symlink/junction targets.
- Preserve unrelated XML bytes, encoding declarations, comments, CDATA, whitespace and CRLF/LF when editing existing files.
- Never print connection secrets in responses, diffs, logs, exceptions or test snapshots.
- Runtime execution retains PENTAHO_ENABLE_EXECUTE=1 and confirmed=true requirements.
- Do not run consumer ETL, alter consumer repositories or modify personal .kettle configuration as part of automated tests.
- No bulk migration or rename occurs implicitly during inspection, validation, startup or runtime detection.

## Execution boundaries and file ownership

Work in `pentaho-mcp-server`, not ETL-WORKSPACE. Record git status before changes; preserve concurrent user changes. Implementation may use an isolated worktree at execution time. This handoff does not authorize executing business ETL or publishing a release. Save small reviewed commits after each passing task when git permissions permit; never stage unrelated files.

New focused modules:

| Module | Responsibility |
|---|---|
| src/repository/paths.js | Typed logical-to-physical identity mapping |
| src/repository/references.js | Verified per-type adapters and pure reference edits |
| src/repository/graph.js | Dependency/incoming-reference scans |
| src/repository/connections.js | .kdb parsing, sanitized CRUD candidates and usage |
| src/repository/transactions.js | Hashes, staging, rollback and recovery |
| src/repository/operations.js | Migration/move/connection rename composition |
| src/repository/registration.js | Effective registry discovery, selection, registration |
| src/tools/repository-schema.js | Shared mutually exclusive selector schemas/adapters |
| src/tools/repository.tools.js | Repository/reference/migration/move tools |
| src/tools/connection.tools.js | Connection tools |

Dependencies: 1 -> 2 -> 3 -> 4; 5 consumes 2; 6 consumes 3/4/5; 7 consumes 6; 8 consumes 2/1; 9 consumes 6/8; 10 consumes all. These form one repository feature, not independent products.

All proposed function names below are new unless explicitly marked existing. Public errors carry a stable `code` and sanitized message; adapt the server error envelope additively to return code without removing error text.

## Task 1: Establish PDI evidence and sanitized fixtures

**Files:** Update `docs/pdi94-repository-evidence.md`; create `test/fixtures/file-repository/`, `test/repository-evidence.test.js`.

**Interfaces:** Produce `test/fixtures/file-repository/evidence.json` with `{pdiVersion,sourceRevision,adapters:[{ownerKind,type,targetKind,nameTag,directoryTag,methodTag,methodValue,objectIdTag,source,fixture}],registry:{sources,precedence},loadcheck:{verified,observations}}`. Actual values come from inspected PDI source, not assumptions. Each adapter fixture is a minimal sanitized KJB/KTR saved/loaded with repository fields.

- [x] Record clean/dirty baseline and run `npm test` plus `npm run verify:profile`; retain failures separately from this feature.
- [x] Inspect PDI 9.4 sources for JobEntryTrans, JobEntryJob, JobExecutorMeta, TransExecutorMeta, MappingMeta and SimpleMappingMeta. Record getXML/loadXML/loadReferencedObject paths and inheritance. Inspect RepositoriesMeta, KettleFileRepositoryMeta, KettleFileRepository and Kitchen/Pan command executor/launcher configuration.
- [x] Create fixtures for all six adapters, root `.kdb`, duplicate embedded connection, missing target and registry with two File Repositories. No copied secrets, real hostnames or actual credentials.
- [x] Add structural evidence assertion:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('required executable adapters have versioned evidence', () => {
  const e = JSON.parse(readFileSync(new URL('./fixtures/file-repository/evidence.json', import.meta.url), 'utf8'));
  assert.match(e.pdiVersion, /^9\.4/);
  assert.ok(e.sourceRevision);
  for (const type of ['TRANS','JOB','JobExecutor','TransExecutor','Mapping','SimpleMapping']) {
    const a = e.adapters.find(x => x.type === type);
    assert.ok(a?.source && a?.fixture, type);
  }
});
```

- [x] Run `node --test test/repository-evidence.test.js`; require PASS before deriving schemas. If a source/runtime cannot be verified, report that exact evidence gap; do not mark fabricated fixtures as verified.
- [x] Commit evidence/fixtures only: `test: establish PDI file repository contracts`.

## Task 2: Typed identity resolver and selector contract

**Files:** Create `src/repository/paths.js`, `src/tools/repository-schema.js`, `test/repository-paths.test.js`. Modify `src/server.js`, `src/tools/read.tools.js`, `src/tools/edit.tools.js`, `src/tools/artifact.tools.js`, `src/tools/remove.tools.js`, `src/tools/validate.tools.js`, `src/tools/knowledge.tools.js`, `src/tools/runtime.tools.js`, `test/server-context.test.js`, `test/tool-boundary.test.js`, `test/tool-contract.test.js`.

**Interfaces:** `createRepositoryPaths(boundary)` -> `{resolveArtifact(selector,{write=false}),resolveDirectory(selector),fromPhysical(physicalPath)}`. Artifact selector `{path?,repositoryPath?,artifactKind?}`; result `{physicalPath,repositoryPath,artifactKind,name,directory}`. Directory selector `{directory?,repositoryDirectory?}`. `artifactSelectorSchema(prefix='')` and `selectArtifact(ctx,args,{prefix='',physicalKey='path',write=false}={})` map tool-specific physical argument names to this resolver. `ctx.repositoryPaths` contains resolver; existing boundary methods remain physical only.

- [x] Write failing resolver tests with temporary roots; include this core assertion using a fixture-created `root` and existing boundary:

```js
const paths = createRepositoryPaths(createWorkspaceBoundary(root));
const id = paths.resolveArtifact({repositoryPath:'/a/check',artifactKind:'trans'}, {write:true});
assert.equal(id.physicalPath, path.join(root,'a','check.ktr'));
assert.equal(id.directory, '/a');
assert.throws(() => paths.resolveArtifact({repositoryPath:'/../escape',artifactKind:'job'}), /path/i);
```

- [x] Run `node --test test/repository-paths.test.js` and observe failure from missing resolver.
- [x] Implement path grammar and kind inference per spec. Reuse boundary at the final step; never trim the leading slash of physical inputs. Reject both selector forms supplied together. Include source/destination and runtime artifact aliases.
- [x] Update schemas/handlers as one task so advertised schemas match behavior. Existing required path fields become selector validation rather than both paths required. Preserve search kind and response physical-path meanings; add repository identity.
- [x] Test root objects, explicit/ambiguous kinds, create without kind, relative/absolute legacy paths, malformed names, source/destination tools, subdirectory inventory root identity and junction escape.
- [x] Run `node --test test/repository-paths.test.js test/server-context.test.js test/tool-boundary.test.js test/tool-contract.test.js`; commit `feat: add typed repository artifact selectors`.

## Task 3: Reference registry and surgical reference assignment

**Files:** Create `src/repository/references.js`, `src/tools/repository.tools.js`, `test/repository-references.test.js`. Modify `src/tools/registry.js`, `src/core/model.js`; update knowledge `job/TRANS.md`, `job/JOB.md`, `trans/JobExecutor.md`, `trans/Mapping.md`; create verified `trans/TransExecutor.md`, `trans/SimpleMapping.md`, `trans/SingleThreader.md`, `trans/MetaInject.md` and update `catalog.yaml` if evidence qualifies.

**Interfaces:** `extractReferences(xml,ownerIdentity)` -> array `{elementName,ownerType,targetKind,method,targetRepositoryPath,status}`; `rewriteReference(xml,{ownerKind,elementName,target})` -> new XML string; target is identity from Task 2. `repositoryTools(ctx)` registered once. New `kettle_set_reference` uses the selectors and arguments in spec.

- [x] Add failing tests for each evidence adapter. For fixture XML `before` and normalized target:

```js
const after = rewriteReference(before, {ownerKind:'job',elementName:'Check users',target});
const [ref] = extractReferences(after, owner);
assert.equal(ref.targetRepositoryPath, '/xuat_user_active/check');
assert.equal(ref.targetKind, 'trans');
assert.equal(ref.elementName, 'Check users');
assert.equal(rewriteReference(after,{ownerKind:'job',elementName:'Check users',target}), after);
```

- [x] Run `node --test test/repository-references.test.js` to establish failure.
- [x] Implement adapter lookup keyed by owner kind/type, not generic tag search. Use existing span utilities to change only target fields and retain CRLF/CDATA/parameters/result routes. Distinguish filename/rep_name/rep_ref/dynamic modes per evidence.
- [x] Implement target existence/kind checks before assignment; do not rename entries. Detect unknown call-bearing types as unsupported findings. Update misleading existing knowledge rules that require entry display name to equal target stem.
- [x] Run reference, span, knowledge and catalog tests; ensure all eight fixtures parse and round-trip. Test unsupported streaming callers produce an incomplete-coverage finding rather than clean validation. Commit `feat: support repository calls across job and trans adapters`.

## Task 4: Dependency graph and bounded repository inventory

**Files:** Create `src/repository/graph.js`, `test/repository-graph.test.js`. Modify `src/core/search.js`, `src/tools/repository.tools.js`, `test/search.test.js`.

**Interfaces:** `scanRepository(ctx,{repositoryDirectory='/'})` -> `{artifacts,edges,issues,complete}`; edge shape from Task 3 plus source identity. `dependencyClosure(scan,identity)` -> `{artifacts,edges,issues,complete}`. Mutation callers require complete full scans; tool output pagination/truncation is separate from scan completeness.

- [x] Write tests for A->B->A, missing B, duplicate basenames in different directories, malformed file and symlink file outside root. Assert:

```js
const scan = scanRepository(ctx, {});
const closure = dependencyClosure(scan, aIdentity);
assert.equal(new Set(closure.artifacts.map(x => x.repositoryPath)).size, 2);
assert.equal(closure.complete, true);
```

- [x] Run `node --test test/repository-graph.test.js` and see failure.
- [x] Implement visited typed identities, boundary validation for every traversed file, ignored internal staging/git/node_modules directories, and explicit incomplete/error status. Resolve only known filename variables; never basename-search missing targets.
- [x] Add list/mkdir/references tools per spec; cap public output <=500 and expose truncation/scan issues. mkdir uses write boundary and selected read-only registration policy when available.
- [x] Run `node --test test/repository-graph.test.js test/search.test.js test/tool-boundary.test.js`; commit `feat: inspect repository dependencies and directories`.

## Task 5: Shared connection model, sanitization and usage

**Files:** Create `src/repository/connections.js`, `src/tools/connection.tools.js`, `test/repository-connections.test.js`. Modify `src/tools/registry.js`, `src/runtime/redact.js`, `src/core/search.js`, `src/core/artifact-edit.js` where shared masking/copy policy applies.

**Interfaces:** `scanConnections(ctx)` -> `{connections,usages,issues,complete}`. Sanitized connection `{name,physicalPath,definition,passwordStatus,hash}`; no raw secret fields. `connectionCandidate(ctx,{name,definition,expectedHash})` -> internal `{physicalPath,before,after}` for candidate validation in Task 6 and transactions in Task 7. `connectionTools(ctx)` exposes list/get/put/usage/delete; put/delete use single-file checked writes initially, upgraded to transaction in Task 7.

- [x] Test a root `.kdb` with synthetic secret marker and a logging connection consumer. Assert no marker appears:

```js
const report = scanConnections(ctx);
assert.ok(report.usages.some(x => x.name === 'warehouse'));
assert.equal(JSON.stringify(report).includes('SYNTHETIC_SECRET_123'), false);
```

- [x] Run `node --test test/repository-connections.test.js` and establish failure.
- [x] Implement exact PDI connection field registry from Task 1: direct, nested logging, multiple connections and embedded duplicates. For standard repository load record the final readDatabases(meta,true) metadata replacement; test consumer bindings separately. Do not use native usage methods returning empty arrays. Test getDatabaseID case-insensitive fallback/collisions. Ambiguity blocks destructive operations. Store names as XML text safely, reject invalid filename identity.
- [x] Implement partial candidate edits preserving omitted password bytes and unknown attributes; new password allows empty/variable only. Validate XML, definition name/filename agreement and optimistic hash. Reject delete if usage scan incomplete or consumers exist. Sanitize diffs/errors/attributes and audit read/search exposure.
- [x] Test round-trip unknown fields/CRLF, stale hash, collision, unresolved usage, untouched encrypted password, new plaintext rejection, masked nested attribute secrets and no secret in raw exception text.
- [x] Run connection, artifact-edit and runtime redaction tests; commit `feat: manage repository database connections`.

## Task 6: Repository-aware candidate validation

**Files:** Modify `src/core/validate.js`, `src/core/edit.js`, `src/core/artifact-edit.js`, `src/core/remove.js`, all mutation tool adapters and `src/tools/validate.tools.js`. Create `test/repository-validation.test.js`.

**Interfaces:** Extend existing `validateXml(xml,filePath,{dir,repositoryContext?,candidateFiles?})`, `validateFile(filePath,{repositoryContext?}={})`, `validateAll(root,{repositoryContext?}={})`. New `validateRepositoryReadiness(ctx,identity,{candidateFiles?}={})` returns `{ready,issues,closure}` using Tasks 4/5. Candidate map uses physical paths -> proposed XML or null for deletions. Core mutation functions gain final optional `{repositoryContext}` or extend their existing options; document signatures at callsites.

- [x] Write failing tests: valid rep_name with empty filename has no missing-filename warning; missing repo target fails; `.kdb` resolves a shared connection; an edit candidate introducing a dangling reference leaves file unchanged.
- [x] Run `node --test test/repository-validation.test.js`.
- [x] Thread context through every edit route (create/clone/add/field/hop/rename/remove/artifact parameters/connection copy). Refactor post-write validation paths into candidate validation. Structural checks stay available without repository context for existing low-level tests.
- [x] Preserve the distinction between unrelated preexisting issues and newly introduced managed-reference defects. Runtime readiness checks reachable dependency closure and blocks unresolved refs. Do not return ready=true on incomplete scans.
- [x] Add byte-identity test on rejected changes:

```js
const before = readFileSync(file, 'utf8');
assert.throws(() => applyInvalidReferenceChange(), /reference|target/i);
assert.equal(readFileSync(file,'utf8'), before);
```

Here `applyInvalidReferenceChange` is the actual tool handler closure configured in the test with a missing target; do not create a production function with that name.

- [x] Run `node --test test/repository-validation.test.js test/validate.test.js test/edit.test.js test/artifact-edit.test.js test/remove.test.js`; commit `feat: validate repository references and connections before writes`.

## Task 7: Previewed migration, artifact move and connection rename

**Files:** Create `src/repository/transactions.js`, `src/repository/operations.js`, `test/repository-transactions.test.js`, `test/repository-operations.test.js`. Modify repository/connection tool factories to expose spec operations and route multi-file writes through transactions.

**Interfaces:** `previewChanges(ctx,changes)` -> sanitized manifest `{id,changes:[{path,beforeHash,afterHash,diff}],issues}`; internal proposed bytes stay in in-root staging. `applyChanges(ctx,{manifest})` revalidates all paths/hashes and proposed content; `recoverChanges(ctx,{transactionId})` rolls back unfinished transaction. `planMigration(ctx,args)`, `planArtifactMove(ctx,args)`, `planConnectionRename(ctx,args)` produce `{changes,issues,complete}`. Manifest binds operation, arguments and candidate hashes; never trust user-supplied staged paths or bytes.

- [x] Write failures for preview-no-write, stale hash rejection, destination collision, interrupted write rollback and restart recovery. Test injected write failure on the second file with original bytes restored.
- [x] Run `node --test test/repository-transactions.test.js test/repository-operations.test.js`.
- [x] Implement exclusive lock, same-root staging, journal, candidate validation, before/after hashes and recovery. Return recovery-required after crash journal discovery; expose `kettle_repository_recover {transactionId}` for explicit rollback. Register this additional tool in docs/schema tests.
- [x] Implement conversion of only proven resolvable legacy call references. Block or skip unsupported/dynamic refs with complete=false. Implement same-repo artifact move plus incoming references and internal artifact name; connection rename plus verified usage. Require complete scans for rename/move/delete and reject ambiguity.
- [x] Test generic filenames (CSV/XLSX/SQL shell text) remain untouched, root moves, case-only names on Windows, two artifact kinds sharing stem, stale preview, no credentials in preview and consumers updated consistently.
- [x] Run transaction/operation and boundary tests; commit `feat: add recoverable repository migrations and renames`.

## Task 8: Effective PDI registry and explicit registration

**Files:** Create `src/repository/registration.js`, `test/repository-registration.test.js`. Modify `src/server.js`, `src/tools/repository.tools.js`, `src/runtime/detect.js`, `test/server-context.test.js`.

**Interfaces:** `detectRepository(ctx,{environment,cwd,javaProperties}={})` -> `{status,registryPath,provenance,repository,issues}`; repository `{name,type,baseDirectory,readOnly}`. `planRegistration(ctx,{name})` -> sanitized preview with original hash/absent marker; `applyRegistration(ctx,{name,expectedHash})` -> result. Read PENTAHO_REPOSITORY_NAME and effective KETTLE_HOME in server context. Registration authorization applies only to effective config file; do not pass it through artifact resolver or allow arbitrary destination args.

- [x] Fixture tests cover home default, env-vs-Java-property precedence, Java-cwd local registry before user registry, KETTLE_DIR and batch launcher cwd changes, user registry shadowing, unknown launcher config, exact root match, duplicate matching registrations and same-name wrong-root. initialDir must not be treated as effective Java cwd.
- [x] Run `node --test test/repository-registration.test.js` and observe missing functionality.
- [x] Implement discovery exactly from Task 1 evidence. When ambiguity cannot be resolved return blocker/provenance. Compare canonical base against ctx.root; support verified local file URI conversion, reject remote scheme.
- [x] Implement preview/apply registry merge preserving unrelated XML and existing definitions, optimistic hash, no startup mutation, no arbitrary config path. Apply cannot overwrite another same-name repo. Surface permission denial without retrying another home/path.
- [x] Assert idempotence and mismatch behavior:

```js
const result = detectRepository(ctx, injectedRuntimeEnvironment);
assert.equal(result.repository.name, 'fixture_repo');
assert.equal(result.repository.baseDirectory, ctx.root);
assert.equal(result.status, 'READY');
```

- [x] Test registration against temporary home only and selected read_only blocks repository writes. Run context/boundary tests; commit `feat: discover and register matched PDI file repositories`.

## Task 9: Repository-aware Kitchen/Pan loadcheck and execution

**Files:** Modify `src/runtime/run.js`, `src/tools/runtime.tools.js`, `src/runtime/detect.js`, `src/runtime/redact.js`, `test/runtime.test.js`. Create `test/runtime-repository.test.js`.

**Interfaces:** `runPdi(request,context)` receives normalized `request.identity`, `request.logLevel`, existing mode/parameters/confirmed and `context.repository` from Task 8. Keep existing exported API compatibility where tests/core callers require it, but tool runtime defaults to repository semantics. New pure `buildRepositoryArgs({identity,repositoryName,mode,parameters,logLevel})` exported from run.js for testing. `classifyLoadcheck({exitCode,stdout,stderr,pdiVersion,evidence})` distinguishes PASS/FAIL/INDETERMINATE using verified version evidence; no broad nonzero-success rule.

- [x] Write failing spawn-spy tests for Kitchen and Pan:

```js
const args = buildRepositoryArgs({identity:{artifactKind:'job',directory:'/batch/job',name:'demo'},repositoryName:'fixture_repo',mode:'execute',parameters:{PRD_ID:'20260911'},logLevel:'Detailed'});
assert.ok(args.includes('/rep:fixture_repo'));
assert.ok(args.includes('/dir:/batch/job'));
assert.ok(args.includes('/job:demo'));
assert.ok(args.includes('/param:PRD_ID=20260911'));
assert.equal(args.some(x => x === '/norep' || x.startsWith('/file:')), false);
```

- [x] Run `node --test test/runtime-repository.test.js`.
- [x] Detect matched repo and validate readiness before spawning. Carry effective environment/cwd consistently. Build `/trans` for trans, `/job` for job; add `/listparam` only for loadcheck. Add schema logLevel enum from spec; preserve timeout and conservative Windows quoting.
- [x] Test no spawn on missing/mismatched registration, unresolved dependencies, execute disabled/unconfirmed and malicious argument values. Source shows both listparam success and load failure return 7; test zero-parameter success without clear output is INDETERMINATE, never blanket-accept 7. Fake missing-repo and missing-job logs must never classify PASS. Do not claim loadcheck is filesystem-side-effect-free because connect can create .meta.
- [x] Test inherited env credentials redacted, bounded logs and timeout process-tree behavior remain intact. Run `node --test test/runtime.test.js test/runtime-repository.test.js`; commit `feat: run PDI tests in verified repository context`.

## Task 10: Documentation, handoff and integration acceptance

**Files:** Modify `README.md`, `docs/configuration.md`, `docs/architecture.md`, `docs/tools-reference.md`, `docs/workflow-guide.md`, `docs/operations.md`, `docs/install.md`, `docs/documentation-facts.md`, `skills/developing-pentaho-jobs/SKILL.md`, `test/tool-contract.test.js`, `test/packaging.test.js`, `test/pentaho-skill.test.js`. Add `scripts/verify-repository-runtime.mjs` and update `docs/pdi94-repository-evidence.md` with actual results.

**Interfaces:** Smoke script takes explicit PDI home and a newly created disposable temp directory, creates isolated `.kettle/repositories.xml`, root connection using dummy values, an inert START->SUCCESS job and a no-database transform. It never executes business fixtures; it reports PDI version, registry name/root, exact sanitized commands, statuses and limitations.

- [ ] Update tool contracts for every new selector and tool, including recovery; preserve old names and error envelope text. Add examples for create/call/validate/connection CRUD/migration preview/registration/loadcheck/execute.
- [ ] Document physical root vs configuration home vs repository name; default-vs-explicit repo selection; source/destination selector pairs; read_only handling; dynamic reference limitations; preview/recovery; credentials masking; no implicit file fallback.
- [ ] Update bundled skill to use repository references for all eight types, report unsupported streaming references, prefer connection tools and run registration/readiness checks before optional runtime. Do not edit the installed personal skill as part of this repository change.
- [ ] Run `npm test` and `npm run verify:profile`; require PASS with no suppressed new failures. Use existing packaging checks; build a release only if requested separately.
- [ ] If PDI 9.4 is available, run the disposable smoke with explicit authorization to execute its inert fixtures, confirming actual version and listparam behavior. Otherwise record NOT RUN and the exact prerequisite, and do not claim runtime integration verified.
- [ ] Check `git diff --check`, review diffs for secrets/consumer paths, and verify every spec section maps to tasks below. Commit `docs: document repository management and runtime workflow`.

## Coverage and completion checklist

| Spec requirement | Tasks |
|---|---|
| Root and typed paths, old selectors | 2 |
| All executable references and version evidence | 1,3,4 |
| Shared .kdb CRUD and usage | 1,5,6,7 |
| Static validation and byte-preserving edits | 3,6 |
| Inventory, mkdir, graph | 4 |
| Migration, artifact move, connection rename, recovery | 7 |
| Effective .kettle discovery and registration | 1,8 |
| Kitchen/Pan repo mode and honest loadcheck | 1,9,10 |
| Docs, skill, compatibility and production checks | 2,10 |

The final implementation report must name changed modules, tests actually run, PDI version/evidence, compatibility changes and unverified items. An evidence limitation must not be converted into an implementation success claim. Deliver this plan with the linked spec; the next AI should not need the original conversation.
