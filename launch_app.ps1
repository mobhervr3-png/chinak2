
Start-Process cmd -ArgumentList "/k title Backend && node server/index.js"
Start-Process cmd -ArgumentList "/k title Frontend && node node_modules/vite/bin/vite.js"
Write-Host "App launched in separate windows."
