$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$bundleName = "nerdygeek"
$packageJson = Get-Content (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$version = $packageJson.version
$stagingRoot = Join-Path $projectRoot ".bundle"
$stagingDir = Join-Path $stagingRoot $bundleName
$serverDir = Join-Path $stagingDir "server"
$artifactsDir = Join-Path $projectRoot "artifacts"
$zipPath = Join-Path $artifactsDir "$bundleName-$version.zip"
$bundlePath = Join-Path $artifactsDir "$bundleName-$version.mcpb"

if (-not (Test-Path (Join-Path $projectRoot "dist\\src\\stdio.js"))) {
  throw "Build output not found. Run npm run build first."
}

Remove-Item -LiteralPath $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $bundlePath -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Path $serverDir -Force | Out-Null
New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot "bundle\\manifest.json") -Destination (Join-Path $stagingDir "manifest.json")
Copy-Item -LiteralPath (Join-Path $projectRoot "bundle\\icon.png") -Destination (Join-Path $stagingDir "icon.png")
Copy-Item -Path (Join-Path $projectRoot "dist\\src\\*") -Destination $serverDir -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "package.json") -Destination (Join-Path $stagingDir "package.json")
Copy-Item -LiteralPath (Join-Path $projectRoot "package-lock.json") -Destination (Join-Path $stagingDir "package-lock.json")
Copy-Item -LiteralPath (Join-Path $projectRoot "README.md") -Destination (Join-Path $stagingDir "README.md")
Copy-Item -LiteralPath (Join-Path $projectRoot "node_modules") -Destination (Join-Path $stagingDir "node_modules") -Recurse

Push-Location $stagingDir
try {
  npm prune --omit=dev --ignore-scripts --no-audit --no-fund | Out-Null
} finally {
  Pop-Location
}

Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
Move-Item -LiteralPath $zipPath -Destination $bundlePath

Write-Output "Created bundle: $bundlePath"
