# JAMES (JARVIS in Hebrew) - one-click installer for Windows.
#
# Installs whatever is missing (Node.js, Google Chrome, Claude Code and the
# Windows Hebrew voice), downloads JARVIS, adds the Hebrew edition from this
# kit, puts a shortcut on the desktop and starts it. Running it again repairs
# and updates the installation in place.
#
# Saved as UTF-8 with a BOM: Windows PowerShell 5.1 needs the BOM to read the
# Hebrew messages below correctly.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Windows.Forms

$Kit    = Split-Path -Parent $MyInvocation.MyCommand.Path
$Commit = 'c249096b69123a288cd4c6880c6ca9dfbfc0a8af'
$Target = Join-Path $env:USERPROFILE 'jarvis'
$Title  = "ג'יימס"
$Owner  = New-Object System.Windows.Forms.Form
$Owner.TopMost = $true

function Step([string]$Text) {
    Write-Host ''
    Write-Host "==> $Text" -ForegroundColor Cyan
}

# A right-to-left message box that comes up in front of everything.
function Popup([string]$Text, [string]$Buttons = 'OK', [string]$Icon = 'Information') {
    $b = [System.Windows.Forms.MessageBoxButtons]$Buttons
    $i = [System.Windows.Forms.MessageBoxIcon]$Icon
    $d = [System.Windows.Forms.MessageBoxDefaultButton]::Button1
    $o = [System.Windows.Forms.MessageBoxOptions]'RightAlign, RtlReading'
    return [System.Windows.Forms.MessageBox]::Show($Owner, $Text, $Title, $b, $i, $d, $o)
}

# Programs installed a moment ago are not on this window's PATH yet.
function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user;$env:USERPROFILE\.local\bin"
}

function Test-Command([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# Runs PowerShell code in a window of its own, optionally as administrator.
# Encoded, so no quoting can go wrong on the way.
function Start-PowerShell([string]$Command, [switch]$Elevated, [switch]$KeepOpen) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
    $psArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass')
    if ($KeepOpen) { $psArgs += '-NoExit' }
    $psArgs += @('-EncodedCommand', $encoded)
    if ($Elevated) {
        Start-Process -FilePath 'powershell.exe' -ArgumentList $psArgs -Verb RunAs -Wait
    } else {
        Start-Process -FilePath 'powershell.exe' -ArgumentList $psArgs -Wait
    }
}

function Find-Chrome {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    return $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}

# An update must not copy files under a running JAMES. Only the instance that
# owns the bridge port (8787) is closed, with its whole process tree: other
# Node programs on this computer are left alone.
function Stop-RunningJames {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $listener = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $listener) { return }
        $bridge = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
        if (-not $bridge -or $bridge.Name -ne 'node.exe') { return }
        Write-Host '    Closing the running JAMES first...'
        & taskkill.exe /PID $bridge.ParentProcessId /T /F 2>$null | Out-Null
        & taskkill.exe /PID $bridge.ProcessId /T /F 2>$null | Out-Null
        Start-Sleep -Seconds 2
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Test-HebrewVoice {
    $roots = @('HKLM:\SOFTWARE\Microsoft\Speech_OneCore\Voices\Tokens', 'HKLM:\SOFTWARE\Microsoft\Speech\Voices\Tokens')
    foreach ($root in $roots) {
        if (Test-Path $root) {
            $found = Get-ChildItem $root -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match 'he-?IL' }
            if ($found) { return $true }
        }
    }
    return $false
}

try {
    Write-Host ''
    Write-Host '  JAMES (JARVIS in Hebrew) - installer' -ForegroundColor Yellow
    Write-Host '  This takes a few minutes. Keep this window open.'
    Popup ("ההתקנה של ג'יימס מתחילה." + "`n`n" + "זה לוקח כמה דקות, והחלון השחור מראה את ההתקדמות." + "`n" + "אם Windows שואל אם לאשר שינויים, ללחוץ 'כן'.") | Out-Null

    # 1. Node.js 20 or newer
    Step 'Node.js'
    Update-SessionPath
    $nodeMajor = 0
    if (Test-Command 'node') {
        $version = (& node -v) | Select-Object -First 1
        if ($version -match '^v(\d+)') { $nodeMajor = [int]$Matches[1] }
    }
    if ($nodeMajor -lt 20) {
        if (-not (Test-Command 'winget')) {
            throw 'Node.js is missing. Install the LTS version from https://nodejs.org and run this installer again.'
        }
        Write-Host '    Installing Node.js...'
        $ErrorActionPreference = 'Continue'
        & winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        $ErrorActionPreference = 'Stop'
        Update-SessionPath
        if (-not (Test-Command 'node')) {
            throw 'Node.js did not install. Install the LTS version from https://nodejs.org and run this installer again.'
        }
    }
    Write-Host ('    Node.js ' + ((& node -v) | Select-Object -First 1))

    # 2. Google Chrome: Hebrew speech recognition comes from Chrome
    Step 'Google Chrome'
    if (-not (Find-Chrome) -and (Test-Command 'winget')) {
        Write-Host '    Installing Google Chrome...'
        $ErrorActionPreference = 'Continue'
        & winget install -e --id Google.Chrome --accept-package-agreements --accept-source-agreements --silent
        $ErrorActionPreference = 'Stop'
    }
    if (Find-Chrome) {
        Write-Host '    OK'
    } else {
        Write-Host '    Chrome was not found. Install it from https://www.google.com/chrome for Hebrew speech.' -ForegroundColor Yellow
    }

    # 3. Claude Code, logged in: JAMES runs on the Claude subscription
    Step 'Claude Code'
    $credentials = Join-Path $env:USERPROFILE '.claude\.credentials.json'
    if (-not (Test-Path $credentials)) {
        if (-not (Test-Command 'claude')) {
            Write-Host '    Installing Claude Code...'
            Start-PowerShell 'irm https://claude.ai/install.ps1 | iex'
            Update-SessionPath
        }
        if (Test-Command 'claude') {
            Popup ("ג'יימס עובד דרך Claude Code, וצריך להיות מחוברים אליו." + "`n`n" + "אחרי לחיצה על אישור ייפתח חלון חדש של Claude Code: לבחור התחברות עם חשבון Claude, ולאשר בדפדפן." + "`n`n" + "כשזה נגמר, או אם כבר מחוברים, לסגור את החלון, וההתקנה תמשיך לבד.") | Out-Null
            Start-PowerShell 'claude' -KeepOpen
        }
    }
    if (Test-Path $credentials) {
        Write-Host '    Logged in'
    } else {
        Write-Host '    Could not confirm the Claude Code login. JAMES will say so if it is missing.' -ForegroundColor Yellow
    }

    # 4. JARVIS itself, at the exact version the Hebrew edition was written for
    Step 'Downloading JARVIS'
    if (Test-Path (Join-Path $Target 'package.json')) {
        Write-Host "    Already downloaded: $Target"
    } else {
        $zip = Join-Path $env:TEMP 'jarvis-download.zip'
        $unpack = Join-Path $env:TEMP 'jarvis-download'
        Invoke-WebRequest -Uri "https://codeload.github.com/gcocenza/jarvis/zip/$Commit" -OutFile $zip -UseBasicParsing
        if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
        Expand-Archive -Path $zip -DestinationPath $unpack -Force
        $source = Get-ChildItem $unpack -Directory | Select-Object -First 1
        New-Item -ItemType Directory -Force -Path $Target | Out-Null
        Copy-Item -Path (Join-Path $source.FullName '*') -Destination $Target -Recurse -Force
        Remove-Item $zip -Force -ErrorAction SilentlyContinue
        Remove-Item $unpack -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "    Saved in $Target"
    }

    # 5. The Hebrew edition: the changed files, the launcher and the icon
    Step 'Adding the Hebrew edition'
    Stop-RunningJames
    $overlay = (Resolve-Path (Join-Path $Kit 'overlay')).ProviderPath
    foreach ($file in Get-ChildItem $overlay -Recurse -File) {
        $relative = $file.FullName.Substring($overlay.Length).TrimStart('\')
        $destination = Join-Path $Target $relative
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
    }
    foreach ($name in @('start-jarvis.bat', 'open-jarvis.ps1', 'jarvis.ico')) {
        Copy-Item -LiteralPath (Join-Path $Kit $name) -Destination (Join-Path $Target $name) -Force
    }
    Write-Host '    OK'

    # 6. Packages
    Step 'Installing packages (the longest step, a few minutes)'
    Push-Location $Target
    $ErrorActionPreference = 'Continue'
    & npm.cmd install --no-audit --no-fund
    $npmExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    Pop-Location
    if ($npmExit -ne 0) { throw 'npm install failed. Scroll up in this window to see why.' }

    # 7. The Windows Hebrew voice, which Chrome speaks Hebrew with
    Step 'Hebrew voice'
    if (Test-HebrewVoice) {
        Write-Host '    OK'
    } else {
        Write-Host '    Adding the Windows Hebrew voice...'
        $addVoice = "Get-WindowsCapability -Online | Where-Object { `$_.Name -like 'Language.TextToSpeech~~~he-IL*' -and `$_.State -ne 'Installed' } | Add-WindowsCapability -Online | Out-Null"
        try {
            Start-PowerShell $addVoice -Elevated
        } catch {
            Write-Host '    Skipped: permission was not given.' -ForegroundColor Yellow
        }
        if (Test-HebrewVoice) {
            Write-Host '    OK'
        } else {
            Start-Process 'ms-settings:speech'
            Popup ("כדי שג'יימס ידבר עברית, צריך להוסיף ל-Windows קול עברי." + "`n`n" + "עכשיו נפתח מסך ההגדרות: ללחוץ על 'הוספת קולות' (Add voices), לבחור 'עברית' ולהתקין." + "`n`n" + "אפשר לעשות את זה גם אחר כך. עד אז הוא מבין עברית ומציג את התשובות על המסך.") | Out-Null
        }
    }

    # 8. Desktop shortcut
    Step 'Desktop shortcut'
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shell = New-Object -ComObject WScript.Shell
    $linkPath = Join-Path $desktop "ג'יימס.lnk"
    try {
        $link = $shell.CreateShortcut($linkPath)
    } catch {
        $linkPath = Join-Path $desktop 'James.lnk'
        $link = $shell.CreateShortcut($linkPath)
    }
    $link.TargetPath = Join-Path $Target 'start-jarvis.bat'
    $link.WorkingDirectory = $Target
    $link.WindowStyle = 7
    $link.IconLocation = (Join-Path $Target 'jarvis.ico') + ',0'
    $link.Description = 'James - Hebrew voice assistant'
    $link.Save()
    Write-Host "    $linkPath"

    # 9. Start
    Step 'Starting JAMES'
    Start-Process -FilePath (Join-Path $Target 'start-jarvis.bat') -WorkingDirectory $Target -WindowStyle Minimized
    Popup ("ג'יימס מותקן!" + "`n`n" + "בעוד רגע ייפתח חלון של Chrome:" + "`n" + "1. ללחוץ על 'הפעלה'." + "`n" + "2. לאשר גישה למיקרופון." + "`n" + "3. להגיד: היי ג'יימס, או למחוא כפיים פעמיים" + "`n`n" + "בפעם הבאה: לחיצה כפולה על ג'יימס בשולחן העבודה." + "`n" + "החלון השחור הממוזער הוא המנוע שלו, וסגירה שלו מכבה אותו.") | Out-Null
}
catch {
    Write-Host ''
    Write-Host ('  Stopped: ' + $_.Exception.Message) -ForegroundColor Red
    Popup ("ההתקנה נעצרה:" + "`n`n" + $_.Exception.Message + "`n`n" + "אפשר להפעיל את ההתקנה שוב (היא ממשיכה מאיפה שנעצרה), או לשלוח לי צילום מסך של החלון השחור.") 'OK' 'Error' | Out-Null
    exit 1
}
