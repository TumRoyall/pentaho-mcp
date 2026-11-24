<#
.SYNOPSIS
  Diagnose a Pentaho Kettle MCP install.

.DESCRIPTION
  Verifies the packaged executable exists, performs an MCP stdio handshake
  (initialize, tools/list), and probes an optional local PDI given by
  -PentahoHome. Exits nonzero when the install or handshake is invalid. A
  missing PDI is reported separately and never fails the check.

.PARAMETER PentahoHome
  Optional PDI home (folder containing Kitchen.bat/Pan.bat) to probe. Runtime
  execution is unavailable without it; static tools still work.
#>
[CmdletBinding()]
param(
  [string] $PentahoHome
)

$ErrorActionPreference = 'Stop'
$failures = @()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$exePath = Join-Path $scriptDir 'pentaho-mcp.exe'

if (-not (Test-Path -LiteralPath $exePath)) {
  Write-Host "[FAIL] executable missing: $exePath"
  exit 1
}
Write-Host "[OK]   executable present: $exePath"

# --- MCP handshake over stdio -------------------------------------------------
function New-Rpc([int]$id, [string]$method) {
  (@{ jsonrpc = '2.0'; id = $id; method = $method; params = @{} } | ConvertTo-Json -Compress -Depth 6)
}

$init = @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{
  protocolVersion = '2024-11-05'; capabilities = @{}; clientInfo = @{ name = 'doctor'; version = '1' } } } | ConvertTo-Json -Compress -Depth 6

$requests = @(
  $init,
  (New-Rpc 2 'tools/list')
) -join "`n"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $exePath
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
# Windows PowerShell (.NET Framework) builds the child's stdin writer from
# [Console]::InputEncoding and emits its BOM as soon as the process starts,
# which corrupts the first JSON-RPC line (initialize). Use BOM-less UTF-8 for
# the duration of the start, then restore the console setting.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$previousInputEncoding = $null
try { $previousInputEncoding = [Console]::InputEncoding; [Console]::InputEncoding = $utf8NoBom } catch {}
try {
  $proc = [System.Diagnostics.Process]::Start($psi)
} finally {
  if ($previousInputEncoding) { try { [Console]::InputEncoding = $previousInputEncoding } catch {} }
}
$bytes = $utf8NoBom.GetBytes($requests + "`n")
$proc.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
$proc.StandardInput.BaseStream.Flush()
$proc.StandardInput.Close()
$stdout = $proc.StandardOutput.ReadToEnd()
$null = $proc.StandardError.ReadToEnd()
if (-not $proc.WaitForExit(60000)) { $proc.Kill() }

$responses = @()
foreach ($line in ($stdout -split "`r?`n")) {
  $t = $line.Trim()
  if ($t.StartsWith('{')) { try { $responses += ($t | ConvertFrom-Json) } catch {} }
}

$serverInfo = ($responses | Where-Object { $_.id -eq 1 }).result.serverInfo
if ($serverInfo) {
  Write-Host "[OK]   MCP initialize: $($serverInfo.name) $($serverInfo.version)"
} else {
  Write-Host "[FAIL] MCP initialize: no valid response"
  $failures += 'initialize'
}

$tools = ($responses | Where-Object { $_.id -eq 2 }).result.tools
if ($tools -and $tools.Count -eq 41) {
  Write-Host "[OK]   MCP handshake: $($tools.Count) tools"
} else {
  $count = if ($tools) { $tools.Count } else { 0 }
  Write-Host "[FAIL] MCP handshake: expected 41 tools, got $count"
  $failures += 'handshake'
}

if ($tools | Where-Object { $_.name -like 'pentaho_*' }) {
  Write-Host "[FAIL] lifecycle pentaho_* tools advertised"
  $failures += 'lifecycle-surface'
} else {
  Write-Host "[OK]   no lifecycle pentaho_* tools advertised"
}

# --- Optional PDI probe (never a failure) -------------------------------------
if ($PentahoHome) {
  $kitchen = Join-Path $PentahoHome 'Kitchen.bat'
  if (Test-Path -LiteralPath $kitchen) {
    Write-Host "[INFO] optional PDI detected: $kitchen"
  } else {
    Write-Host "[INFO] optional PDI not found under $PentahoHome (runtime execution unavailable; static tools still work)"
  }
} else {
  Write-Host "[INFO] no -PentahoHome supplied; runtime execution disabled, static tools still work"
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "doctor: FAILED ($($failures -join ', '))"
  exit 1
}
Write-Host ""
Write-Host "doctor: OK"
exit 0
