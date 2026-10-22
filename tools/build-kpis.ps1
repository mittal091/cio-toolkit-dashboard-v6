# Builds data/kpis.json from the Excel file, so KPI names, domains and owners always match the Excel.
# Usage: powershell -File tools/build-kpis.ps1 "C:\path\CIO Toolkit Final KPIs.xlsx"
param([Parameter(Mandatory=$true)][string]$Xlsx, [string]$Out = "")
if (-not $Out) { $Out = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\data\kpis.json" }
# Owner names we show instead of the Excel text (agreed with the dashboard owner). Everything else is used exactly as in the Excel.
$OwnerNames = @{ 'Finance / CIO office' = 'CIO Office'; 'CIO office' = 'CIO Office'; 'Cloud / FinOps lead' = 'FinOps Lead' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($Xlsx)
if (-not $zip) { throw "Could not open $Xlsx. If it is open in Excel, pass a copy of the file." }
function Entry($n) { $e = $zip.Entries | Where-Object { $_.FullName -eq $n }; if (-not $e) { return $null }; $sr = New-Object IO.StreamReader($e.Open()); $t = $sr.ReadToEnd(); $sr.Close(); $t }
$strings = @()
$ssx = Entry 'xl/sharedStrings.xml'
if ($ssx) { foreach ($si in ([xml]$ssx).sst.si) { if ($si.t -is [string]) { $strings += $si.t } elseif ($si.t.'#text') { $strings += $si.t.'#text' } else { $strings += (($si.r | ForEach-Object { if ($_.t -is [string]) { $_.t } else { $_.t.'#text' } }) -join '') } } }
$sheet = [xml](Entry 'xl/worksheets/sheet1.xml')
$zip.Dispose()
$rows = @($sheet.worksheet.sheetData.row)
$header = @{}
foreach ($c in @($rows[0].c)) { $col = $c.r -replace '\d', ''; $header[$col] = $strings[[int]$c.v] }
function Slug($s) { (($s.ToLower() -replace '%', ' pct ') -replace '[^a-z0-9]+', '-').Trim('-') }
$kpis = @()
foreach ($r in $rows | Select-Object -Skip 1) {
  $h = @{}
  foreach ($c in @($r.c)) { $col = $c.r -replace '\d', ''; $v = $c.v; if ($c.t -eq 's') { $v = $strings[[int]$v] }; $h[$header[$col]] = $v }
  if (-not $h['KPI']) { continue }
  $kpis += [ordered]@{
    id = (Slug $h['KPI']); name = $h['KPI']; domain = $h['Domain']; owner = $(if ($OwnerNames.ContainsKey($h['Suggested owner'])) { $OwnerNames[$h['Suggested owner']] } else { $h['Suggested owner'] })
    definition = $h['Definition / formula']; dataSource = $h['Typical data source']; refresh = $h['Refresh']
    view = $h['Dashboard view']; complexity = $h['Integration complexity']
    aiValue = $h['AI value']; aiRole = $h['AI role']; aiHelp = $h['How AI helps (or why not)']
    risk = $h['Risk / caution']; mvp = ($h['MVP candidate'] -eq 'Y')
  }
}
if ($kpis.Count -eq 0) { throw "No KPIs were read from $Xlsx, so $Out was left unchanged. If the file is open in Excel, pass a copy." }
[IO.File]::WriteAllText($Out, ($kpis | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding $false))
"Wrote $($kpis.Count) KPIs to $Out"
