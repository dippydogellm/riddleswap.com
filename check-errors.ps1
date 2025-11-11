$output = npm run check 2>&1
$lines = $output -split "`n"
$lastFewLines = $lines[-10..-1]
Write-Host ($lastFewLines -join "`n")
