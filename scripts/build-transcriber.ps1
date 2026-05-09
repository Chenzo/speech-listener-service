$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$outputDir = Join-Path $root "release-assets\transcribe"
$workDir = Join-Path $root ".pyinstaller\build"
$specDir = Join-Path $root ".pyinstaller"
$entryPoint = Join-Path $root "transcribe.py"

py -3 -m PyInstaller --version | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "PyInstaller is required to build the bundled transcriber. Run: py -3 -m pip install pyinstaller"
}

py -3 -c "import vosk" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "The Python vosk package is required to build the bundled transcriber. Run: py -3 -m pip install vosk"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
New-Item -ItemType Directory -Force -Path $specDir | Out-Null

py -3 -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --name transcribe `
  --distpath $outputDir `
  --workpath $workDir `
  --specpath $specDir `
  --collect-all vosk `
  $entryPoint
