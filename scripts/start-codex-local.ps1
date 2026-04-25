$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\acer\Downloads\NerdyGeek'
Set-Location $projectRoot
npm run build | Out-Host
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
if ($listener) { Stop-Process -Id $listener -Force -ErrorAction SilentlyContinue }
$p = Start-Process -FilePath node -ArgumentList 'dist/src/httpServer.js' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
Write-Output "NerdyGeek local MCP started on http://127.0.0.1:3000/mcp (PID=$($p.Id))"
