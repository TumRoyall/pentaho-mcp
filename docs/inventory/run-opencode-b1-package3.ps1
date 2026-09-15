param(
    [Parameter(Mandatory=$true)][ValidateSet('tests','implement','fix')][string]$Phase,
    [string]$SessionId,
    [string]$FeedbackFile
)

$ErrorActionPreference = 'Stop'
$batchRepo = 'C:/Users/TumRoyal/Documents/GitHub/pentaho-mcp-server'
if ((Get-Location).Path.Replace('\','/').TrimEnd('/') -ne $batchRepo) {
    throw 'Run from the pentaho-mcp-server repository root.'
}
if ($Phase -ne 'tests' -and -not $SessionId) { throw 'A known session ID is required for implement/fix.' }

$batchFiles = @(
    'test/knowledge-stream-control.test.js',
    'docs/inventory/2026-09-15-b1-package3-source-notes.md'
)
if ($Phase -ne 'tests') {
    $batchFiles += @(
        'src/knowledge/pentaho/trans/Append.md',
        'src/knowledge/pentaho/trans/BlockingStep.md',
        'src/knowledge/pentaho/trans/DetectEmptyStream.md',
        'src/knowledge/pentaho/trans/DetectLastRow.md',
        'src/knowledge/pentaho/catalog.yaml',
        'docs/pdi94-evidence-report.md',
        'docs/inventory/2026-09-15-pdi94-components.md',
        'docs/inventory/2026-09-15-pdi94-components.json'
    )
}
$batchEdits = [ordered]@{'*'='deny'}
foreach ($batchFile in $batchFiles) {
    $batchEdits[$batchFile] = 'allow'
    $batchEdits[($batchRepo+'/'+$batchFile)] = 'allow'
    $batchEdits[($batchRepo+'/'+$batchFile).Replace('/','\')] = 'allow'
}
$batchPermissions = [ordered]@{
    '*'='deny'; read='allow'; glob='allow'; grep='allow'; list='allow';
    skill='allow'; todowrite='allow'; todoread='allow'; bash='deny'; edit=$batchEdits;
    external_directory=[ordered]@{
        '*'='ask';
        'C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle/*'='allow';
        'C:\Users\TumRoyal\Documents\GitHub\pentaho-kettle\*'='allow'
    }
}
$batchPrompt = @'
You are the OpenCode implementation agent for Pentaho PDI 9.4 catalog expansion.
The user authorizes this batch and primary Codex coordinates and reviews you.
Read docs/inventory/PDI94-HANDOFF.md and the linked plan docs/superpowers/plans/2026-09-15-expand-pdi94-component-catalog.md. B1 packages 1 and 2 are already accepted; do not redo or modify them.
Your batch has ONLY these 4 transformation-step IDs (final B1 package): Append, BlockingStep, DetectEmptyStream, DetectLastRow.
Locate the real XML step id and class in engine/src/main/resources/kettle-steps.xml (do not guess the id from the display name). Likely classes under engine/src/main/java/org/pentaho/di/trans/steps/: append/AppendMeta, blockingstep/BlockingStepMeta, detectemptystream/DetectEmptyStreamMeta, detectlaststep/DetectLastRowMeta — verify each against the registry before trusting it.
Use source C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle pinned at 1a939ab5cabe4517867879684aeca2a526bcc638 (9.4).
For each ID read getXML/loadXML (or readData)/setDefault, superclass/helpers and the StepMeta wrapper. Read runtime semantics: BlockingStep buffering/spooling and its cache/sort/pass-all-rows behaviour, Append two-input head/tail stream references, DetectEmptyStream single-empty-row emission and its output fields, DetectLastRow the added boolean result field name. Cite exact class/method/line at the pinned commit.
Registry presence is not XML evidence. Do not fabricate Spoon/runtime verification; evidence stays source_reviewed.
Read existing knowledge references (e.g. trans/Dummy.md, trans/SortRows.md, trans/FilterRows.md) and test patterns in test/knowledge-result-files.test.js and test/knowledge-components.test.js. Node tests must use temporary files, never external I/O or business runtime. Do not import Java or assume installed PDI in Node tests.
Shell is disabled in your invocation; primary Codex runs tests and provides results. Never bypass permissions via other tools. No commit, push, new dependencies, additional IDs, source Pentaho edits, business execution, or changing handoff/runner.
Preserve unrelated existing edits (packages 1 and 2 references, catalog rows, evidence report). Keep status distinctions: implemented is not independently reviewed.
Append/BlockingStep reference other steps by name (head/tail, or none): if a step names a target/source step, note whether an enabled hop is required, mirroring how existing references document step references.
'@
switch ($Phase) {
    'tests' {
        $batchPrompt += @'

PHASE tests: Read source for the four IDs and write test/knowledge-stream-control.test.js plus a concise docs/inventory/2026-09-15-b1-package3-source-notes.md.
Test, for each ID: findByXmlType(kind,id) exists; getReference returns a template whose first fenced XML block is one <step> with the correct direct-child <type>; isGeneratorEligible matches the intended evidence level; actual addElement() insertion into a minimal trans copy with name escaping (& and <); a meaningful non-default configuration where the step has one (e.g. BlockingStep cache_size / sort fields / pass_all_rows; Append head/tail step names); and knowledgeCoverage no longer reports them missing.
Ground assertions in source, not invented configuration names. For a step whose body is empty (verify against source), assert the empty body rather than inventing tags. Assert important runtime pitfalls only when meaningful without simulating PDI or claiming engine verification.
Do NOT write references, catalog, evidence or inventory yet. Stop after the test and source-notes files exist; report READY FOR PRIMARY TO RUN RED tests, not that tests passed.
'@
    }
    'implement' {
        $batchPrompt += @'

PHASE implement: Primary has run the new tests and confirmed RED because the four catalog entries are absent. Implement the four references and catalog rows using your source research. Keep the first XML block a full <step> suitable for the existing editor (proper StepMeta wrapper: name, type, description, distribute, custom_distribution, copies, partitioning, then the plugin body if any, then attributes, cluster_schema, remotesteps, GUI). Add field tables, examples, exact constructor defaults versus load-missing-tag fallbacks, runtime semantics and source evidence (file+method+line at the pinned commit). Add four catalog rows with unique design aliases and verified XML ids, canonical + generator_eligible:true + source_version "9.4" + verified_versions "9.4" + verification source_reviewed only if source truly supports it; otherwise keep observed with a stated reason. Update docs/pdi94-evidence-report.md counts from the ACTUAL catalog (currently 100 rows) and add per-row evidence. Update only these four inventory statuses/checklists after source-reviewed implementation, without claiming independent test/review completion. Keep existing stale historical counts explicitly baseline; do not silently redefine the original inventory universe. Fix the new tests only when justified by actual source; do not weaken them to hide a broken template. Stop and report READY FOR PRIMARY tests/review.
'@
    }
    'fix' {
        if (-not $FeedbackFile) { throw 'FeedbackFile required for fix.' }
        $batchPrompt += "`nPHASE fix: Address the following primary review, then report changes and pending tests:`n"
        $batchPrompt += Get-Content -LiteralPath $FeedbackFile -Raw
    }
}
$batchLog = Join-Path $env:TEMP "opencode-b1-package3-$Phase.jsonl"
$batchPriorConfig = $env:OPENCODE_CONFIG_CONTENT
try {
    $env:OPENCODE_CONFIG_CONTENT = @{
        permission=$batchPermissions
        agent=@{build=@{permission=$batchPermissions}}
    } | ConvertTo-Json -Depth 8 -Compress
    $batchArgs = @('run','--model','opencode/muse-spark-1.3-contributor-free','--format','json')
    if ($SessionId) { $batchArgs += @('--session',$SessionId) }
    else { $batchArgs += @('--title','PDI 9.4 B1 package 3 stream control') }
    $batchArgs += $batchPrompt
    & opencode.cmd @batchArgs *> $batchLog
    $batchExit = $LASTEXITCODE
    Get-Content -LiteralPath $batchLog -Tail 2
} finally {
    if ($null -eq $batchPriorConfig) { Remove-Item Env:OPENCODE_CONFIG_CONTENT -ErrorAction SilentlyContinue }
    else { $env:OPENCODE_CONFIG_CONTENT = $batchPriorConfig }
}
exit $batchExit
