# Opens JARVIS in a Chrome window of its own once the local server answers.
$ProgressPreference = 'SilentlyContinue'
$url = 'http://localhost:5173'
for ($i = 0; $i -lt 180; $i++) {
    try {
        Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($chrome) {
    # App mode: a clean full window for the HUD, and a real Chrome window, so
    # the microphone works (embedded previews block it).
    Start-Process -FilePath $chrome -ArgumentList "--app=$url", '--start-maximized'
} else {
    Start-Process $url
}
