$ErrorActionPreference = "Stop"

$modelName = "vosk-model-small-en-us-0.15"
$modelUrl = "https://alphacephei.com/vosk/models/$modelName.zip"
$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$modelsDir = Join-Path $projectRoot "models"
$modelDir = Join-Path $modelsDir $modelName
$zipPath = Join-Path $modelsDir "$modelName.zip"

if (Test-Path -LiteralPath $modelDir) {
  Write-Host "Model already exists: $modelDir"
  exit 0
}

New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

Write-Host "Downloading $modelName..."
Invoke-WebRequest -Uri $modelUrl -OutFile $zipPath

Write-Host "Extracting model..."
Expand-Archive -LiteralPath $zipPath -DestinationPath $modelsDir -Force
Remove-Item -LiteralPath $zipPath -Force

Write-Host "Model installed: $modelDir"
