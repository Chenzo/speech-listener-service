$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$overlayDir = Join-Path $root "obs_overlay"
$distDir = Join-Path $root "dist"
$zipPath = Join-Path $distDir "obs_overlay.zip"

$requiredFiles = @(
  "index.html",
  "styles.css"
)

foreach ($file in $requiredFiles) {
  $path = Join-Path $overlayDir $file

  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Missing OBS overlay file: $path"
  }
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

try {
  foreach ($file in $requiredFiles) {
    $sourcePath = Join-Path $overlayDir $file
    $entryName = "obs_overlay/$file"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $sourcePath, $entryName) | Out-Null
  }

  $zip.CreateEntry("obs_overlay/audio/") | Out-Null
} finally {
  $zip.Dispose()
}

Write-Host "Created $zipPath"
