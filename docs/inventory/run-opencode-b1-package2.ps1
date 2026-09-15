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
    'test/knowledge-result-files.test.js',
    'docs/inventory/2026-09-15-b1-package2-source-notes.md'
)
if ($Phase -ne 'tests') {
    $batchFiles += @(
        'src/knowledge/pentaho/trans/FilesFromResult.md',
        'src/knowledge/pentaho/trans/FilesToResult.md',
        'src/knowledge/pentaho/job/ADD_RESULT_FILENAMES.md',
        'src/knowledge/pentaho/job/DELETE_RESULT_FILENAMES.md',
        'src/knowledge/pentaho/job/COPY_MOVE_RESULT_FILENAMES.md',
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
Read docs/inventory/PDI94-HANDOFF.md and the linked plan. B1 package 1 is already accepted; do not redo it.
Your batch has ONLY these 5 IDs: trans FilesFromResult, trans FilesToResult; job ADD_RESULT_FILENAMES, DELETE_RESULT_FILENAMES, COPY_MOVE_RESULT_FILENAMES.
Use source C:/Users/TumRoyal/Documents/GitHub/pentaho-kettle pinned at 1a939ab5cabe4517867879684aeca2a526bcc638 (9.4).
Read getXML/loadXML or readData/setDefault, superclass/helpers and wrapper. Read runtime semantics for result filenames, conditions, filters, deletion of result metadata versus physical files, copy/move side effects and output field names. Cite exact class/method/lines.
Registry presence is not XML evidence. Do not fabricate Spoon/runtime verification.
Read existing knowledge references and test patterns. Node tests should use temporary files, never external I/O or business runtime. Do not import Java or assume installed PDI in Node tests.
Shell is disabled in your invocation; primary Codex runs tests and provides results. Never bypass permissions via other tools. No commit, push, new dependencies, additional IDs, source Pentaho edits, business execution or changing handoff/runner.
Preserve unrelated existing edits. Keep status distinctions: implemented is not independently reviewed.
'@
switch ($Phase) {
    'tests' {
        $batchPrompt += @'

PHASE tests: Read source for the five IDs and write test/knowledge-result-files.test.js plus concise docs/inventory/2026-09-15-b1-package2-source-notes.md.
Test catalog eligibility, first template direct-child XML type, actual addElement insertion for both job and trans, escaping, non-default relevant XML fields or repeated lists, and coverage. Ground assertions in source rather than inventing configuration names. Assert important runtime pitfalls only when meaningful without simulating PDI or claiming engine verification.
Do not write references, catalog, evidence or inventory yet. Stop after tests and source notes exist; report ready for primary to run RED tests, not that tests passed.
'@
    }
    'implement' {
        $batchPrompt += @'

PHASE implement: Primary has run the new tests and confirmed RED because the five catalog entries are absent. Implement the five references and catalog rows using your source research. Keep the first XML block a full step/entry suitable for the existing editor. Add field tables, examples, exact defaults versus load fallbacks, runtime semantics and source evidence. Update evidence report counts from actual catalog and add per-row evidence. Update only these five inventory statuses/checklists after source-reviewed implementation, without claiming independent test/review completion. Keep existing stale historical counts explicitly baseline; do not silently redefine the original inventory universe. Fix new tests only when justified by actual source; do not weaken them to hide a broken template. Stop and report ready for primary tests/review.
'@
    }
    'fix' {
        if (-not $FeedbackFile) { throw 'FeedbackFile required for fix.' }
        $batchPrompt += "`nPHASE fix: Address the following primary review, then report changes and pending tests:`n"
        $batchPrompt += Get-Content -LiteralPath $FeedbackFile -Raw
    }
}
$batchLog = Join-Path $env:TEMP "opencode-b1-package2-$Phase.jsonl"
$batchPriorConfig = $env:OPENCODE_CONFIG_CONTENT
try {
    $env:OPENCODE_CONFIG_CONTENT = @{
        permission=$batchPermissions
        agent=@{build=@{permission=$batchPermissions}}
    } | ConvertTo-Json -Depth 8 -Compress
    $batchArgs = @('run','--model','opencode/muse-spark-1.3-contributor-free','--format','json')
    if ($SessionId) { $batchArgs += @('--session',$SessionId) }
    else { $batchArgs += @('--title','PDI 9.4 B1 package 2 result files') }
    $batchArgs += $batchPrompt
    & opencode.cmd @batchArgs *> $batchLog
    $batchExit = $LASTEXITCODE
    Get-Content -LiteralPath $batchLog -Tail 2
} finally {
    if ($null -eq $batchPriorConfig) { Remove-Item Env:OPENCODE_CONFIG_CONTENT -ErrorAction SilentlyContinue }
    else { $env:OPENCODE_CONFIG_CONTENT = $batchPriorConfig }
}
exit $batchExit
