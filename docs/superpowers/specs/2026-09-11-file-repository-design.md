# Pentaho File Repository support — specification

Status: implementation handoff requested by user; no implementation performed.
Date: 2026-09-11. Baseline inspected: `fe05a2f`.

Source-review update: read `../../pdi94-repository-evidence.md` alongside this specification. Local Pentaho branch 9.4, commit `1a939ab5cabe4517867879684aeca2a526bcc638`, declares 9.4.0.0-SNAPSHOT. Findings below are source-reviewed, not installed-runtime-verified. The evidence report's optional roadmap does not expand this implementation scope.

## 1. Objective and agreed requirements

Make this MCP manage a local Pentaho File Repository. `KETTLE_ROOT` points to its physical base directory. Job/transformation references use repository directory plus object name, including calls inside transformations. Manage shared database connections stored as `.kdb`. Kitchen/Pan test execution must connect to the repository registered in the effective PDI configuration.

Example:

```text
KETTLE_ROOT=C:/work/dte-repo
repositoryPath=/xuat_user_active/etl_trans_ctl_check_users_active_ready
kind=trans
physicalPath=C:/work/dte-repo/xuat_user_active/etl_trans_ctl_check_users_active_ready.ktr
```

```xml
<specification_method>rep_name</specification_method>
<trans_object_id/>
<filename/>
<transname>etl_trans_ctl_check_users_active_ready</transname>
<directory>/xuat_user_active</directory>
```

Extensions remain on disk. Do not put the extensionless logical path into `<filename>`. The display name of an entry/step is independent of the target object name; do not rename it or its hops merely to update the target.

## 2. Baseline and concrete defects

- `src/workspace/boundary.js` enforces canonical filesystem containment. Preserve it as the final physical-path boundary.
- `src/server.js` creates filesystem context; tool factories in `src/tools/registry.js` consume it.
- Tool path schemas and `src/core/model.js:kindOf` currently expect filesystem paths with `.kjb`/`.ktr`.
- `src/core/validate.js` checks JOB/TRANS filenames and embedded connection definitions; missing filenames produce a repository-reference warning instead of resolving the target.
- `src/core/artifact-edit.js` copies embedded connections only. No dedicated `.kdb` management exists.
- `src/runtime/run.js` always constructs `/file:... /norep /level:Basic`; `runtime.tools.js` infers kind from extension.
- `src/knowledge/pentaho/trans/TransExecutor.md` and `SimpleMapping.md` do not exist at the inspected baseline. Do not invent templates from the names alone.
- Consumer sample `dte-repo/etl_job_xuat_user_active.kjb` references `/xuat_user_active/etl_trans_ctl_check_users_active_ready`, but the corresponding sample file currently sits at repository root. Report this as a missing target; never silently search by basename or move it.

## 3. Global constraints

- Node.js >=20; JavaScript ESM; keep existing MCP SDK and fast-xml-parser; no new runtime dependency without a documented need.
- Primary target: Windows and PDI 9.4; portable unit tests must also pass where supported.
- All artifact and connection reads/writes remain inside canonical KETTLE_ROOT, including symlink/junction targets.
- Preserve unrelated XML bytes, encoding declarations, comments, CDATA, whitespace and CRLF/LF when editing existing files.
- Never print connection secrets in responses, diffs, logs, exceptions or test snapshots.
- Runtime execution retains PENTAHO_ENABLE_EXECUTE=1 and confirmed=true requirements.
- Do not run consumer ETL, alter consumer repositories or modify personal .kettle configuration as part of automated tests.
- No bulk migration or rename occurs implicitly during inspection, validation, startup or runtime detection.

## 4. Configuration and path contract

Repository semantics are the default MCP artifact contract. Keep existing relative/absolute filesystem inputs with explicit artifact extensions for compatibility. Preserve unset `KETTLE_ROOT` -> `process.cwd()` behavior and containment enforcement.

New context setting `PENTAHO_REPOSITORY_NAME` optionally selects the registered PDI repository explicitly. This is an MCP setting, not an existing PDI variable. Use PDI's existing `KETTLE_HOME` semantics for configuration discovery. `PENTAHO_HOME` continues to locate Kitchen/Pan.

New tool selectors are `repositoryPath` and `artifactKind` (`job|trans`). Existing `path`, `artifact`, `sourcePath`, `destPath` remain physical-path selectors. Exactly one selector form is allowed for each target. Source/destination tools use `sourceRepositoryPath`, `destRepositoryPath`, `sourceArtifactKind`, `destArtifactKind`. Existing search `kind` retains its current meaning; never repurpose it as artifact kind. Directory-scoped tools retain physical `directory` and add mutually exclusive `repositoryDirectory`.

Rules:

1. Repository paths start with `/`, use `/` separators, and contain no `.kjb`/`.ktr` suffix. `/` denotes a directory, never an artifact.
2. Artifact names must be a single nonempty segment. Reject `.`/`..` segments, backslashes, drive prefixes, UNC paths, NUL and OS-invalid filename segments. Do not percent-decode paths.
3. Root artifact `/name` maps to directory `/`, name `name`. Normalize trailing slash only for directory inputs.
4. Existing-object reads may infer kind only when exactly one of `.kjb`/`.ktr` exists. Both -> `AMBIGUOUS_ARTIFACT`; neither -> `ARTIFACT_NOT_FOUND`. Creation requires artifactKind. Explicit kind always resolves only that extension.
5. Resolve the resulting physical path through `boundary.resolveRead/resolveWrite`. Do not change the filesystem boundary to reinterpret absolute paths as repository paths.
6. Identity is `{repositoryPath, artifactKind}`. Return it alongside existing physical path fields; never silently change existing response field meanings.
7. Physical filename stem is the File Repository lookup identity. Report disagreement with internal XML artifact name as an `ARTIFACT_NAME_MISMATCH` warning, not an automatic load blocker: this source's loadJob/loadTransformation replaces the loaded name with the requested name. Set both consistently on create/clone/rename.
8. Output root-relative repository identity uses the configured repository root even when scanning a subdirectory.

## 5. Reference adapters and dependency graph

Create one shared adapter registry for discovering, normalizing, writing and validating executable artifact references. Never globally replace `<filename>`, `<directory>` or arbitrary XML strings: many are data file paths.

Required adapters and expected field families (verify against PDI 9.4 source plus fixtures before coding):

| Owner kind/type | Target | Name | Directory |
|---|---|---|---|
| job / TRANS | trans | transname | directory |
| job / JOB | job | jobname | directory |
| trans / TransExecutor | trans | trans_name | directory_path |
| trans / JobExecutor | job | job_name | directory_path |
| trans / Mapping | trans | trans_name | directory_path |
| trans / SimpleMapping | trans | trans_name | directory_path |
| trans / SingleThreader | trans | trans_name | directory_path |
| trans / MetaInject | trans | trans_name | directory_path |

Inventory BaseStreamStepMeta subclasses as executable callers too. Their serializers require per-plugin evidence; when unsupported, explicitly report incomplete coverage and block unsafe migration/readiness instead of emitting guessed standard tags. Distinguish XML-declared mode from effective load mode: JobEntryJob/loadXML and the common MetaFileLoaderImpl contain context-dependent legacy behavior. The first eight adapters are required; arbitrary streaming serializer support is not assumed.

Each adapter owns its actual method values, object-id field, filename field, variable behavior and any alternate modes. The table is a verification target, not sufficient evidence to manufacture unsupported XML. Audit other knowledge types and source usages; unsupported executable-reference patterns produce an explicit finding, not a false clean result. Arbitrary shell commands/scripts are not rewritten.

`kettle_set_reference` takes an artifact selector, `elementName`, `targetRepositoryPath`, `targetKind` and writes all relevant fields together: repo method, split name/directory, empty stale filename/object ID where appropriate. Preserve parameters, result streams, grouping and entry/step name. Missing target, incompatible type or unresolved schema prevents writes. Existing generic edits must use the same validation context; they must not bypass reference policy on touched fields.

Expose `kettle_repository_references` with `direction=outgoing|incoming|both`, optional artifact selector and bounded results. Every edge identifies source, element, adapter type, target kind/path and status. Traverse using visited identities; cycles terminate and are reported, not automatically rejected because recursive designs may be intentional.

Legacy `filename` references remain readable and visibly classified `LEGACY_FILE_REFERENCE`; new managed calls use repository references. Resolve only supported Internal variables and provided variables. Unknown variable -> `UNRESOLVED_REFERENCE`, not existence success. Repository-object-id mode must be explicitly classified and either resolved with verified File Repository semantics or blocked for migration/runtime readiness.

Bulk migration `kettle_repository_migrate_references` takes `repositoryDirectory` (default `/`) and `apply` (default false). Preview returns bounded diffs, issues and per-file hashes. Apply requires the preview manifest, rechecks hashes and uses only unambiguous, in-root targets. Missing, external, dynamic or unsupported references remain unchanged and are reported; `complete=false` when any remain. Never fall back to basename search. Migration only transforms call references, not external data paths or connection definitions.

## 6. Connection and repository management

`.kdb` objects are rooted at repository base, containing a `<connection>` definition. Confirm actual read/write behavior from PDI 9.4 File Repository source. Do not confuse repository registration XML, `.kdb`, embedded `<connection>` blocks and `.kettle/shared.xml`.

Connection tools:

- `kettle_connection_list`: names, types and physical paths, no credentials.
- `kettle_connection_get {name}`: sanitized structured fields, attributes and password status (`empty|variable|encrypted|present`), never raw password.
- `kettle_connection_put {name, definition, expectedHash?}`: create/update `.kdb`; update requires expectedHash. Definition supports server/type/access/database/port/username, string attributes, and password placeholder. Omitted fields preserve existing content; creation emits verified PDI fields/defaults. Accept empty or `${VARIABLE}` passwords; preserve existing encrypted/plaintext bytes when untouched, but do not expose them or introduce new plaintext passwords.
- `kettle_connection_usage {name}`: all known consumers with provenance (`repository|embedded|ambiguous|unresolved`) and scan issues.
- `kettle_connection_rename {name,newName,apply=false,manifest?}`: preview then apply changes to `.kdb` filename/internal name and verified consumers. Block collision, embedded-name ambiguity and incomplete usage discovery.
- `kettle_connection_delete {name,expectedHash}`: reject referenced, ambiguous or incompletely scanned connections. No force-delete option in this release.

Build a connection-field registry for both direct and nested references, including logging connections and multi-connection job entries present in the knowledge catalog. Validate precedence of repository vs embedded definitions using PDI evidence. Until precedence can be determined for a duplicate, report ambiguity instead of silently selecting one. Generic search/raw readers and error paths must not provide a bypass around `.kdb` sanitization. Attribute values with secret/token/password keys also require masking. No decryption.

Source refinement: File Repository load-by-name calls readDatabases(meta,true) after parsing, replacing matching definitions in the metadata list with root .kdb definitions. Record this known precedence rather than classifying every duplicate as ambiguous; verify step/entry binding behavior with runtime fixtures before claiming full effective-connection equivalence. getDatabaseID includes case-insensitive fallback, so detect case-folded connection collisions. Native getJobsUsingDatabase/getTransformationsUsingDatabase return empty arrays and must not be used as proof of no consumers.

Repository tools:

- `kettle_repository_list {repositoryDirectory='/',recursive=false,limit=100}`: directories and artifact identities; default bounded response, limit <=500.
- `kettle_repository_mkdir {repositoryDirectory}`: contained create, idempotent existing directory.
- `kettle_repository_move {artifact selector,targetRepositoryPath,apply=false,manifest?}`: same-repo artifact move/rename, updates internal identity and incoming known references, preserves display names and connection definitions. Reject collisions, ambiguous/dynamic incoming references and incomplete scan.

Expose `kettle_repository_recover {transactionId}` to explicitly roll back a detected incomplete repository transaction; accept only journal IDs owned by this repository, never caller-provided file paths.

Folder recursive moves/deletes, cross-repository moves, database/enterprise repositories, arbitrary metastore editing and database connectivity tests are outside this release. Empty-directory management can be added separately; do not delete trees to simulate a move.

Multi-file applies use one shared transaction service: preview full change set, hashes and sanitized diffs; revalidate every source/destination and hash before first write; stage candidates; maintain an in-root recovery journal and backups; roll back on ordinary failures. Crash consistency is not falsely advertised as filesystem-wide atomicity. Detect incomplete journal on next invocation and block further writes until explicit recovery. Guard against concurrent writers using exclusive transaction lock and test stale/conflicting state. Keep staging out of repository inventory.

## 7. Static validation and editing pipeline

Thread repository context through validators and all mutation pathways, including create, clone, artifact edits, remove and runtime static preflight. Use in-memory candidate validation before replacing originals. Report separate structural errors, reference issues and connection issues. Incomplete unrelated legacy references may be reported during an unrelated surgical edit; a change introducing a malformed/dangling managed reference must fail. Runtime readiness is stricter: missing or unresolved reachable executable dependencies block execution with actionable diagnostics.

Resolve repository references to correct extension and check existence inside root. Validate the transitive executable dependency closure with a visited set. Check connection availability across that closure. Do not require a database login merely for static checks. Whole-repo scans list parse/read failures and never claim complete when scans are incomplete. Respect limits without interpreting truncation as absence.

## 8. Runtime repository registration and execution

Separate physical repository storage from the registry mapping names to storage:

```xml
<repositories>
  <repository>
    <id>KettleFileRepository</id>
    <name>tckt_file</name>
    <description>Local ETL file repository</description>
    <base_directory>C:/work/dte-repo</base_directory>
    <read_only>N</read_only>
    <hides_hidden_files>N</hides_hidden_files>
  </repository>
</repositories>
```

Verify optional XML field spellings against the installed 9.4 source before generating registry XML. This example's hide-hidden field must not be inferred from local command output using a differently named selector.

Local source confirms `hides_hidden_files`. RepositoriesMeta reads local Java-cwd repositories.xml before the user file, whereas writeData writes the user file. Kitchen/Pan batch scripts pushd to their installation and call Spoon.bat, which changes cwd to KETTLE_DIR. Detection must model that effective Java cwd and report shadowed registry files; the initialDir argument is not the registry lookup cwd. If a local registry shadows the user file, never claim that updating only the user file makes the registration effective.

PDI 9.4 `Const.getUserHomeDirectory` checks environment KETTLE_HOME, then Java system property KETTLE_HOME, then Java user.home. Default `getUserBaseDir` is `.kettle`. Registration discovery must match effective Kitchen/Pan configuration, including supported registry overrides and local `repositories.xml` lookup order as verified in Task 1. Do not assume Node home equals Java user.home. Expose selected registry path and discovery provenance; unresolved/custom launcher behavior blocks automatic registration rather than guessing.

Selection: explicit PENTAHO_REPOSITORY_NAME must exist and match canonical KETTLE_ROOT; otherwise select only if exactly one registered File Repository points to that root. Zero -> `REPOSITORY_NOT_REGISTERED`; multiple -> `REPOSITORY_AMBIGUOUS`; mismatched root -> `REPOSITORY_ROOT_MISMATCH`. Never fall back to `/file` after failure. For local File Repository enforce local base_directory; decode file URI with a proper URL conversion if supported, reject nonlocal schemes. Honor read_only for repository write operations when that registration is selected.

`kettle_repository_detect` reports effective configuration, registration status, type/name/base, runtime availability and blockers, with secrets masked. `kettle_repository_register {name,apply=false,expectedHash?}` previews adding the current KETTLE_ROOT to the selected writable registry; applying preserves unrelated definitions and requires unchanged original hash (or explicit absent-file marker). Existing same-name same-root is idempotent; different-root is conflict. Registration outside KETTLE_ROOT is a narrow exception limited to the resolved registry file, never an arbitrary caller-selected filesystem write. Requires normal host filesystem permission; preview remains usable if apply is denied. No automatic user-home edits on startup.

Runtime builds arguments from normalized identity:

```text
Kitchen.bat /rep:tckt_file /dir:/engine_tckt/batch/job_dba/job /job:etl_job_engine_tckt_ftp_tt2_bieulaisuat /param:PRD_ID=20260911 /param:DIRECT=input /level:Detailed
Pan.bat /rep:tckt_file /dir:/xuat_user_active /trans:etl_trans_ctl_check_users_active_ready /level:Basic
```

Do not append `/file` or `/norep` in repository mode. The MCP receives resolved parameter values; it does not expand Windows `%...%` input strings through a shell. Preserve conservative Windows argument validation, timeout/process-tree termination, bounded output, secret masking and execution policy. Pass the verified effective environment/cwd consistently to detection and execution. Add logLevel enum `Basic|Detailed|Debug|Rowlevel|Error|Nothing`, default Basic.

Loadcheck adds `/listparam` and loads metadata without job execution; it does not verify all runtime effects. Verify version-specific list-command exit behavior: master source shows nonzero listparam success, so `code===0` is not a sufficient universal classifier. Do not blanket-accept nonzero exit codes. Capture known output/status evidence for installed PDI 9.4 or report `INDETERMINATE`; test missing job and invalid repo cannot become PASS. Execute still requires user-authorized run plus confirmed=true and the existing server enable flag.

Local 9.4 snapshot confirms Kitchen and Pan listparam return code 7, also used for genuine load failure. Zero-parameter output may be insufficient for classification; return INDETERMINATE unless success is proven. A structured Java metadata-load probe is a possible follow-up if reliable PASS is required. Repository connect may create .meta; metadata load must not be advertised as zero filesystem writes. Use disposable repositories in tests.

## 9. Evidence and verification gates

During implementation record exact PDI version/source revision, source method, fixture and assertion for each adapter, registry resolution and connection behavior in `docs/pdi94-repository-evidence.md`. Current research establishes the direction; it is not a claim that every adapter/runtime detail was verified on installed 9.4.

Sources:

- [PDI 9.4 Const.java](https://raw.githubusercontent.com/pentaho/pentaho-kettle/9.4/core/src/main/java/org/pentaho/di/core/Const.java): getUserHomeDirectory/getKettleDirectory/registry paths.
- [Kitchen documentation](https://docs.pentaho.com/pdia-data-integration/9.3-data-integration/advanced-topics-pentaho-data-integration-overview/use-command-line-tools-to-run-transformations-and-jobs/kitchen-options-and-syntax): rep/dir/job/listparam/norep/log levels.
- [Pan documentation](https://docs.pentaho.com/pdia-data-integration/advanced-topics-pentaho-data-integration-overview/use-command-line-tools-to-run-transformations-and-jobs/pan-options-and-syntax).
- [KitchenCommandExecutor master](https://github.com/pentaho/pentaho-kettle/blob/master/engine/src/main/java/org/pentaho/di/kitchen/KitchenCommandExecutor.java): repository attachment and listparam exit; master is not proof of 9.4 behavior.
- [KettleFileRepository master](https://github.com/pentaho/pentaho-kettle/blob/master/engine/src/main/java/org/pentaho/di/repository/filerep/KettleFileRepository.java): investigate load/save database metadata and object paths on 9.4.

Mandatory tests: both separators/Windows drives, collision and kind ambiguity, root objects, traversal/junction escape, all eight adapters plus unsupported streaming coverage, legacy/dynamic references, cyclic dependency graph, missing targets, embedded/shared connections, secret redaction, stale previews, rollback/recovery, repository name/root mismatch, effective KETTLE_HOME, exact Kitchen/Pan args and loadcheck false positives. Use temporary sanitized fixtures only. Real PDI smoke uses a disposable registry/repo and inert START->SUCCESS job; never the user's business jobs. Lack of PDI is an explicit unverified integration result, not PASS.

## 10. Delivery acceptance

All existing tool names remain usable with physical selectors; repository selectors work across read/edit/validate/coverage/runtime. Known reference types round-trip through verified XML. Connection management handles root .kdb files and usage safely. Registry discovery and explicit registration are reviewable. Runtime executes with matched repository context. Migration/moves are previewable and recoverable. Full unit/contract suite and production profile checks pass; integration evidence states exactly what ran. Documentation and bundled skill teach the new semantics. Ship no consumer data or secrets.
