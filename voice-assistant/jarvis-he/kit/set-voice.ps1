# JAMES's voice: a natural Hebrew voice from Google Cloud Text-to-Speech.
#
# Asks for the Google API key (pasted here, and kept on this computer only),
# plays the Hebrew male voices one after another so the voice is picked by ear,
# saves the choice next to JAMES in voice-settings.cmd, which start-jarvis.bat
# reads, and restarts him. Run it again to change the voice, or to go back to
# the free Windows voice.
#
# Saved as UTF-8 with a BOM, like the installer, for the Hebrew text.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Target   = Join-Path $env:USERPROFILE 'jarvis'
$Bridge   = Join-Path $Target 'bridge\server.mjs'
$Settings = Join-Path $Target 'voice-settings.cmd'
$Title    = "הקול של ג'יימס"
$Api      = 'https://texttospeech.googleapis.com/v1'
$Sample   = "שלום, אני ג'יימס. ככה אני אשמע מעכשיו. במה אפשר לעזור?"
$Key      = $null
$Heard    = @{}
$Owner    = New-Object System.Windows.Forms.Form
$Owner.TopMost = $true

# A right-to-left message box that comes up in front of everything.
function Popup([string]$Text, [string]$Buttons = 'OK', [string]$Icon = 'Information') {
    $b = [System.Windows.Forms.MessageBoxButtons]$Buttons
    $i = [System.Windows.Forms.MessageBoxIcon]$Icon
    $d = [System.Windows.Forms.MessageBoxDefaultButton]::Button1
    $o = [System.Windows.Forms.MessageBoxOptions]'RightAlign, RtlReading'
    return [System.Windows.Forms.MessageBox]::Show($Owner, $Text, $Title, $b, $i, $d, $o)
}

# A right-to-left window with a message, an optional text box and a row of
# buttons. Returns which button was clicked (-1 if the window was closed) and
# what was typed in the box.
function Ask([string]$Text, [string[]]$Buttons, [switch]$WithBox) {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = $Title
    $form.RightToLeft = 'Yes'
    $form.RightToLeftLayout = $true
    $form.StartPosition = 'CenterScreen'
    $form.TopMost = $true
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.AutoSize = $true
    $form.AutoSizeMode = 'GrowAndShrink'
    $form.Padding = New-Object System.Windows.Forms.Padding(14)
    $form.Font = New-Object System.Drawing.Font('Segoe UI', 11)

    $layout = New-Object System.Windows.Forms.FlowLayoutPanel
    $layout.FlowDirection = 'TopDown'
    $layout.AutoSize = $true
    $layout.WrapContents = $false

    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.AutoSize = $true
    $label.MaximumSize = New-Object System.Drawing.Size(540, 0)
    $label.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 12)
    $layout.Controls.Add($label)

    $box = $null
    if ($WithBox) {
        $box = New-Object System.Windows.Forms.TextBox
        $box.Width = 520
        $box.RightToLeft = 'No'
        $box.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 12)
        $layout.Controls.Add($box)
    }

    $row = New-Object System.Windows.Forms.FlowLayoutPanel
    $row.AutoSize = $true
    $row.WrapContents = $false
    $script:clicked = -1
    for ($n = 0; $n -lt $Buttons.Count; $n++) {
        $button = New-Object System.Windows.Forms.Button
        $button.Text = $Buttons[$n]
        $button.AutoSize = $true
        $button.Padding = New-Object System.Windows.Forms.Padding(8, 2, 8, 2)
        $button.Tag = $n
        $button.Add_Click({ $script:clicked = [int]$this.Tag; $this.FindForm().Close() })
        $row.Controls.Add($button)
        if ($n -eq 0) { $form.AcceptButton = $button }
    }
    $layout.Controls.Add($row)
    $form.Controls.Add($layout)
    if ($box) { $form.Add_Shown({ $box.Focus() }) }
    [void]$form.ShowDialog()
    $typed = ''
    if ($box) { $typed = $box.Text.Trim() }
    $form.Dispose()
    return [pscustomobject]@{ Index = $script:clicked; Text = $typed }
}

# What Google's refusal means, in words, with the page that fixes it opened.
function Explain-GoogleError([string]$Detail) {
    if ($Detail -match 'API_KEY_INVALID|API key not valid') {
        return "Google לא מכירה את המפתח הזה. כדאי להעתיק אותו שוב מדף Credentials ב-Google Cloud, ולהריץ שוב את SET-VOICE.bat."
    }
    if ($Detail -match 'SERVICE_DISABLED|has not been used|it is disabled') {
        $link = 'https://console.cloud.google.com/apis/library/texttospeech.googleapis.com'
        if ($Detail -match 'https://console\.developers\.google\.com/apis/api/texttospeech\.googleapis\.com/overview\?project=[\w-]+') { $link = $Matches[0] }
        Start-Process $link
        return "בפרויקט ב-Google Cloud עוד לא מופעל Cloud Text-to-Speech API. בדף שנפתח עכשיו ללחוץ Enable (הפעלה), לחכות דקה, ולהריץ שוב את SET-VOICE.bat."
    }
    if ($Detail -match 'BILLING_DISABLED|billing') {
        Start-Process 'https://console.cloud.google.com/billing'
        return "לפרויקט עוד לא מחובר חשבון חיוב. בדף שנפתח עכשיו לחבר חשבון חיוב, ואז להריץ שוב את SET-VOICE.bat. החיוב מתחיל רק אחרי המכסה החינמית."
    }
    if ($Detail -match 'API_KEY_SERVICE_BLOCKED|blocked') {
        return "המפתח מוגבל לשירות אחר. בהגדרות המפתח ב-Google Cloud, תחת API restrictions, לבחור Cloud Text-to-Speech API, לשמור, ולהריץ שוב את SET-VOICE.bat."
    }
    return "Google החזירה שגיאה:`n" + $Detail.Substring(0, [Math]::Min(500, $Detail.Length))
}

function Invoke-Google([string]$Method, [string]$Path, $Body = $null) {
    $request = @{
        Method          = $Method
        Uri             = "$Api/$Path"
        Headers         = @{ 'x-goog-api-key' = $script:Key }
        UseBasicParsing = $true
    }
    if ($Body) {
        # Bytes, not a string: Windows PowerShell would send a string body in
        # Latin-1, and the Hebrew sample would arrive as question marks.
        $request.ContentType = 'application/json; charset=utf-8'
        $request.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 5 -Compress))
    }
    try {
        return Invoke-RestMethod @request
    } catch {
        $detail = "$($_.ErrorDetails.Message)"
        if (-not $detail) { $detail = $_.Exception.Message }
        throw (Explain-GoogleError $detail)
    }
}

# Plays the sample sentence in one voice. Each voice is generated once: a
# second listen replays the same file.
function Play-Voice([string]$Name) {
    if (-not $Heard.ContainsKey($Name)) {
        $body = @{
            input       = @{ text = $Sample }
            voice       = @{ languageCode = 'he-IL'; name = $Name }
            audioConfig = @{ audioEncoding = 'LINEAR16' }
        }
        $answer = Invoke-Google 'POST' 'text:synthesize' $body
        $wav = Join-Path $env:TEMP ('james-voice-{0}.wav' -f ($Heard.Count + 1))
        [IO.File]::WriteAllBytes($wav, [Convert]::FromBase64String($answer.audioContent))
        $Heard[$Name] = $wav
    }
    $player = New-Object System.Media.SoundPlayer $Heard[$Name]
    $player.PlaySync()
    $player.Dispose()
}

# Most natural first: Chirp 3 HD, with the calmest characters at the front.
function Rank([string]$Name) {
    $calm = @('Charon', 'Orus', 'Puck', 'Fenrir')
    if ($Name -match 'Chirp3-HD-(\w+)$') {
        $at = [array]::IndexOf($calm, $Matches[1])
        if ($at -lt 0) { $at = 50 }
        return $at
    }
    if ($Name -match 'Neural2') { return 100 }
    if ($Name -match 'Wavenet') { return 200 }
    return 300
}

function Describe([string]$Name) {
    if ($Name -match 'Chirp3-HD-(\w+)$') { return "$($Matches[1]) (Chirp 3 HD, הכי טבעי)" }
    if ($Name -match '-(Neural2|Wavenet|Standard)-(\w+)$') { return "$($Matches[2]) ($($Matches[1]))" }
    return $Name
}

# The same as the installer: only the JAMES that owns the bridge port is
# closed, with its whole process tree.
function Stop-RunningJames {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $listener = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $listener) { return }
        $bridge = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
        if (-not $bridge -or $bridge.Name -ne 'node.exe') { return }
        & taskkill.exe /PID $bridge.ParentProcessId /T /F 2>$null | Out-Null
        & taskkill.exe /PID $bridge.ProcessId /T /F 2>$null | Out-Null
        Start-Sleep -Seconds 2
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Restart-James {
    Stop-RunningJames
    Start-Process -FilePath (Join-Path $Target 'start-jarvis.bat') -WorkingDirectory $Target -WindowStyle Minimized
}

try {
    if (-not (Test-Path $Bridge) -or -not (Select-String -Path $Bridge -Pattern 'JARVIS_GOOGLE_TTS_KEY' -Quiet)) {
        Popup ("קודם צריך להתקין או לעדכן את ג'יימס: לחיצה כפולה על INSTALL-JAMES.bat בתיקייה הזאת." + "`n" + "אחר כך להפעיל שוב את SET-VOICE.bat.") 'OK' 'Warning' | Out-Null
        exit 1
    }

    # A key saved earlier is reused, so the voice can be changed without it.
    if (Test-Path $Settings) {
        $found = Select-String -Path $Settings -Pattern 'JARVIS_GOOGLE_TTS_KEY=([0-9A-Za-z_\-]{30,80})'
        if ($found) {
            $answer = Ask "ג'יימס כבר מדבר בקול של Google. מה לעשות?" @('להחליף קול', 'לחזור לקול של Windows', 'יציאה')
            if ($answer.Index -eq 1) {
                Remove-Item $Settings -Force
                Restart-James
                Popup "ג'יימס חזר לקול של Windows, והוא נפתח מחדש." | Out-Null
                exit 0
            }
            if ($answer.Index -ne 0) { exit 0 }
            $Key = $found.Matches[0].Groups[1].Value
        }
    }

    while (-not $Key) {
        $answer = Ask ("להדביק כאן את המפתח מ-Google Cloud (API key)." + "`n" + "הוא מתחיל ב-AIza, ונשמר רק במחשב הזה. אין לשלוח אותו לאף אחד, גם לא בצ'אט.") @('המשך', 'ביטול') -WithBox
        if ($answer.Index -ne 0) { exit 0 }
        if ($answer.Text -match '^[0-9A-Za-z_\-]{30,80}$') {
            $Key = $answer.Text
        } else {
            Popup "זה לא נראה כמו מפתח של Google. מפתח מתחיל בדרך כלל ב-AIza, ויש בו כ-39 אותיות ומספרים. כדאי להעתיק אותו שוב." 'OK' 'Warning' | Out-Null
        }
    }

    # The Hebrew voices Google has now, men's voices only: JAMES speaks of
    # himself in the masculine.
    $all = @((Invoke-Google 'GET' 'voices?languageCode=he-IL').voices)
    $male = @($all | Where-Object { $_.ssmlGender -eq 'MALE' })
    if (-not $male.Count) { $male = $all }
    if (-not $male.Count) { throw 'Google did not return any Hebrew voices.' }
    $voices = @($male | Sort-Object @{ Expression = { Rank $_.name } }, @{ Expression = { $_.name } } | ForEach-Object { $_.name })

    Popup ("המפתח עובד. עכשיו נשמע את הקולות אחד אחד, עם אותו משפט." + "`n" + "כדאי להגביר את הרמקולים.") | Out-Null

    $at = 0
    $chosen = $null
    while (-not $chosen) {
        $name = $voices[$at]
        Play-Voice $name
        $answer = Ask ("קול {0} מתוך {1}: {2}" -f ($at + 1), $voices.Count, (Describe $name)) @('לבחור בקול הזה', 'לשמוע שוב', 'הקול הבא', 'ביטול')
        switch ($answer.Index) {
            0 { $chosen = $name }
            1 { }
            2 { $at = ($at + 1) % $voices.Count }
            default { exit 0 }
        }
    }

    $lines = @(
        "@rem JAMES's Google voice, written by SET-VOICE.bat. Delete this file to go back to the Windows voice.",
        "set ""JARVIS_GOOGLE_TTS_KEY=$Key""",
        "set ""JARVIS_GOOGLE_VOICE=$chosen"""
    )
    [IO.File]::WriteAllLines($Settings, [string[]]$lines, (New-Object System.Text.ASCIIEncoding))

    Restart-James
    Popup ("מעכשיו ג'יימס מדבר בקול " + (Describe $chosen) + "." + "`n`n" + "הוא נפתח מחדש: ללחוץ 'הפעלה' ולהגיד 'היי ג'יימס'." + "`n" + "כדי להחליף קול, להפעיל שוב את SET-VOICE.bat.") | Out-Null
}
catch {
    Popup ($_.Exception.Message) 'OK' 'Error' | Out-Null
    exit 1
}
