# JAMES's voice: a natural Hebrew voice from Google Cloud Text-to-Speech.
#
# Asks for the Google API key (pasted here, and kept on this computer only),
# then shows every Hebrew male voice in one list: selecting a voice plays it,
# so voices can be compared back and forth before one is chosen. The choice is
# saved next to JAMES in voice-settings.cmd, which start-jarvis.bat reads, and
# he restarts. Run it again to change the voice, or to go back to the free
# Windows voice; the key is kept in google-key.txt so it is pasted only once.
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
$KeyFile  = Join-Path $Target 'google-key.txt'
$Title    = "הקול של ג'יימס"
$Api      = 'https://texttospeech.googleapis.com/v1'
$Sample   = "שלום, אני ג'יימס. ככה אני אשמע מעכשיו. במה אפשר לעזור?"
$Key      = $null
$Heard    = @{}
$Player   = $null
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
        return "Google לא מכירה את המפתח הזה. כדאי להעתיק אותו שוב מדף Credentials ב-Google Cloud (לחיצה על המפתח, ואז Show key)."
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

# Plays a sentence in one voice without waiting for it to end, so the next
# voice can be picked mid-sentence. Each voice and sentence is generated once.
function Play-Voice([string]$Name, [string]$Text) {
    $cacheKey = "$Name|$Text"
    if (-not $Heard.ContainsKey($cacheKey)) {
        $body = @{
            input       = @{ text = $Text }
            voice       = @{ languageCode = 'he-IL'; name = $Name }
            audioConfig = @{ audioEncoding = 'LINEAR16' }
        }
        $answer = Invoke-Google 'POST' 'text:synthesize' $body
        $wav = Join-Path $env:TEMP ('james-voice-{0}.wav' -f ($Heard.Count + 1))
        [IO.File]::WriteAllBytes($wav, [Convert]::FromBase64String($answer.audioContent))
        $Heard[$cacheKey] = $wav
    }
    if ($script:Player) { $script:Player.Stop(); $script:Player.Dispose() }
    $script:Player = New-Object System.Media.SoundPlayer $Heard[$cacheKey]
    $script:Player.Play()
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

function Voice-Name([string]$Name) {
    if ($Name -match 'Chirp3-HD-(\w+)$') { return $Matches[1] }
    if ($Name -match '-(Neural2|Wavenet|Standard)-(\w+)$') { return "$($Matches[1]) $($Matches[2])" }
    return $Name
}

function Voice-Kind([string]$Name) {
    if ($Name -match 'Chirp3-HD') { return 'הכי טבעי (Chirp 3 HD)' }
    if ($Name -match 'Neural2') { return 'טבעי (Neural2)' }
    if ($Name -match 'Wavenet') { return 'טבעי למחצה (WaveNet)' }
    if ($Name -match 'Standard') { return 'רגיל (Standard)' }
    return ''
}

function Describe([string]$Name) {
    return "$(Voice-Name $Name), $(Voice-Kind $Name)"
}

# One window with every voice. Selecting a voice plays it (arrows work too), so
# voices can be compared back and forth; the sentence they say can be changed.
# Returns the chosen voice's name, or $null.
function Choose-Voice([string[]]$Voices, [string]$Current) {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = $Title
    $form.RightToLeft = 'Yes'
    $form.RightToLeftLayout = $true
    $form.StartPosition = 'CenterScreen'
    $form.TopMost = $true
    $form.Size = New-Object System.Drawing.Size(640, 700)
    $form.MinimumSize = New-Object System.Drawing.Size(480, 480)
    $form.Font = New-Object System.Drawing.Font('Segoe UI', 11)

    $table = New-Object System.Windows.Forms.TableLayoutPanel
    $table.Dock = 'Fill'
    $table.Padding = New-Object System.Windows.Forms.Padding(12)
    $table.ColumnCount = 1
    $table.RowCount = 5
    [void]$table.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 100)))
    [void]$table.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('AutoSize')))
    [void]$table.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Percent', 100)))
    [void]$table.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('AutoSize')))
    [void]$table.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('AutoSize')))
    [void]$table.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('AutoSize')))

    $intro = New-Object System.Windows.Forms.Label
    $intro.Text = "לחיצה על קול משמיעה אותו. אפשר לעבור בין הקולות עם החיצים ולחזור לכל קול כמה שרוצים. כשמחליטים: 'לבחור בקול הזה'."
    $intro.AutoSize = $true
    $intro.MaximumSize = New-Object System.Drawing.Size(590, 0)
    $intro.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 8)

    $list = New-Object System.Windows.Forms.ListView
    $list.View = 'Details'
    $list.FullRowSelect = $true
    $list.MultiSelect = $false
    $list.HideSelection = $false
    $list.RightToLeftLayout = $true
    $list.Dock = 'Fill'
    [void]$list.Columns.Add('מספר', 70)
    [void]$list.Columns.Add('קול', 220)
    [void]$list.Columns.Add('סוג', 260)
    for ($n = 0; $n -lt $Voices.Count; $n++) {
        $item = New-Object System.Windows.Forms.ListViewItem ([string]($n + 1))
        $shown = Voice-Name $Voices[$n]
        if ($Voices[$n] -eq $Current) { $shown += ' (עכשיו)' }
        [void]$item.SubItems.Add($shown)
        [void]$item.SubItems.Add((Voice-Kind $Voices[$n]))
        [void]$list.Items.Add($item)
    }

    $sampleLabel = New-Object System.Windows.Forms.Label
    $sampleLabel.Text = 'המשפט שהקולות אומרים (אפשר לשנות):'
    $sampleLabel.AutoSize = $true
    $sampleLabel.Margin = New-Object System.Windows.Forms.Padding(0, 10, 0, 4)

    $sampleBox = New-Object System.Windows.Forms.TextBox
    $sampleBox.Text = $Sample
    $sampleBox.Dock = 'Fill'

    $row = New-Object System.Windows.Forms.FlowLayoutPanel
    $row.AutoSize = $true
    $row.WrapContents = $false
    $row.Margin = New-Object System.Windows.Forms.Padding(0, 12, 0, 0)
    $choose = New-Object System.Windows.Forms.Button
    $choose.Text = 'לבחור בקול הזה'
    $play = New-Object System.Windows.Forms.Button
    $play.Text = 'להשמיע שוב'
    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Text = 'ביטול'
    foreach ($button in @($choose, $play, $cancel)) {
        $button.AutoSize = $true
        $button.Padding = New-Object System.Windows.Forms.Padding(10, 3, 10, 3)
        $row.Controls.Add($button)
    }

    $table.Controls.Add($intro, 0, 0)
    $table.Controls.Add($list, 0, 1)
    $table.Controls.Add($sampleLabel, 0, 2)
    $table.Controls.Add($sampleBox, 0, 3)
    $table.Controls.Add($row, 0, 4)
    $form.Controls.Add($table)
    $form.CancelButton = $cancel

    $script:picked = $null
    $script:quiet = $true
    $playSelected = {
        if ($script:quiet -or $list.SelectedIndices.Count -ne 1) { return }
        $form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
        try {
            $text = $sampleBox.Text.Trim()
            if (-not $text) { $text = $Sample }
            Play-Voice $Voices[$list.SelectedIndices[0]] $text
        } catch {
            Popup ($_.Exception.Message) 'OK' 'Warning' | Out-Null
        } finally {
            $form.Cursor = [System.Windows.Forms.Cursors]::Default
        }
    }
    $list.Add_SelectedIndexChanged($playSelected)
    $list.Add_ItemActivate($playSelected)
    $play.Add_Click($playSelected)
    $choose.Add_Click({
        if ($list.SelectedIndices.Count -ne 1) {
            Popup 'קודם לבחור קול מהרשימה.' | Out-Null
            return
        }
        $script:picked = $Voices[$list.SelectedIndices[0]]
        $form.Close()
    })
    $cancel.Add_Click({ $form.Close() })
    # The voice in use now is selected when the window opens, silently.
    $form.Add_Shown({
        $at = [Math]::Max(0, [array]::IndexOf($Voices, $Current))
        $list.Items[$at].Selected = $true
        $list.Items[$at].Focused = $true
        $list.EnsureVisible($at)
        [void]$list.Focus()
        $script:quiet = $false
    })
    $form.Add_FormClosed({ if ($script:Player) { $script:Player.Stop() } })
    [void]$form.ShowDialog()
    $form.Dispose()
    return $script:picked
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

    # A key saved earlier is reused, so it is pasted only once.
    $saved = $null
    $current = $null
    if (Test-Path $Settings) {
        $found = Select-String -Path $Settings -Pattern 'JARVIS_GOOGLE_TTS_KEY=([0-9A-Za-z_\-]{30,80})'
        if ($found) { $saved = $found.Matches[0].Groups[1].Value }
        $found = Select-String -Path $Settings -Pattern 'JARVIS_GOOGLE_VOICE=([\w\-]+)'
        if ($found) { $current = $found.Matches[0].Groups[1].Value }
    }
    if (-not $saved -and (Test-Path $KeyFile)) {
        $text = (Get-Content $KeyFile -Raw).Trim()
        if ($text -match '^[0-9A-Za-z_\-]{30,80}$') { $saved = $text }
    }

    if ($current) {
        $answer = Ask "ג'יימס כבר מדבר בקול של Google. מה לעשות?" @('להחליף קול', 'לחזור לקול של Windows', 'יציאה')
        if ($answer.Index -eq 1) {
            Remove-Item $Settings -Force
            Restart-James
            Popup "ג'יימס חזר לקול של Windows, והוא נפתח מחדש. המפתח נשמר, כך שאפשר לחזור לקולות של Google בלי להדביק אותו שוב." | Out-Null
            exit 0
        }
        if ($answer.Index -ne 0) { exit 0 }
    }

    # The Hebrew voices Google has now. Listing them is also the key's test.
    $Key = $saved
    $all = $null
    while (-not $all) {
        while (-not $Key) {
            $answer = Ask ("להדביק כאן את המפתח מ-Google Cloud (API key)." + "`n" + "הוא מתחיל ב-AIza, ונשמר רק במחשב הזה. אין לשלוח אותו לאף אחד, גם לא בצ'אט.") @('המשך', 'ביטול') -WithBox
            if ($answer.Index -ne 0) { exit 0 }
            if ($answer.Text -match '^[0-9A-Za-z_\-]{30,80}$') {
                $Key = $answer.Text
            } else {
                Popup "זה לא נראה כמו מפתח של Google. מפתח מתחיל בדרך כלל ב-AIza, ויש בו כ-39 אותיות ומספרים. כדאי להעתיק אותו שוב." 'OK' 'Warning' | Out-Null
            }
        }
        try {
            $all = @((Invoke-Google 'GET' 'voices?languageCode=he-IL').voices)
        } catch {
            if ($_.Exception.Message -notlike '*לא מכירה את המפתח*') { throw }
            Popup ($_.Exception.Message) 'OK' 'Warning' | Out-Null
            Remove-Item $KeyFile -Force -ErrorAction SilentlyContinue
            $Key = $null
        }
    }
    # Google accepted it: keep it, so changing the voice never needs it again.
    [IO.File]::WriteAllText($KeyFile, $Key, (New-Object System.Text.ASCIIEncoding))

    # Men's voices only: JAMES speaks of himself in the masculine.
    $male = @($all | Where-Object { $_.ssmlGender -eq 'MALE' })
    if (-not $male.Count) { $male = $all }
    if (-not $male.Count) { throw 'Google did not return any Hebrew voices.' }
    $voices = @($male | Sort-Object @{ Expression = { Rank $_.name } }, @{ Expression = { $_.name } } | ForEach-Object { $_.name })

    $chosen = Choose-Voice $voices $current
    if (-not $chosen) { exit 0 }

    $lines = @(
        "@rem JAMES's Google voice, written by SET-VOICE.bat. Delete this file to go back to the Windows voice.",
        "set ""JARVIS_GOOGLE_TTS_KEY=$Key""",
        "set ""JARVIS_GOOGLE_VOICE=$chosen"""
    )
    [IO.File]::WriteAllLines($Settings, [string[]]$lines, (New-Object System.Text.ASCIIEncoding))

    Restart-James
    Popup ("מעכשיו ג'יימס מדבר בקול " + (Voice-Name $chosen) + "." + "`n`n" + "הוא נפתח מחדש: ללחוץ 'הפעלה' ולהגיד 'היי ג'יימס'." + "`n" + "כדי להחליף קול, להפעיל שוב את SET-VOICE.bat.") | Out-Null
}
catch {
    Popup ($_.Exception.Message) 'OK' 'Error' | Out-Null
    exit 1
}
