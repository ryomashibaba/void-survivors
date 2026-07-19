$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Write-Step($text) {
    Write-Host ""
    Write-Host "=== $text ===" -ForegroundColor Cyan
}

function Stop-WithMessage($text) {
    Write-Host ""
    Write-Host $text -ForegroundColor Red
    exit 1
}

function Find-Git {
    $command = Get-Command git -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $desktopGit = Get-ChildItem `
        "$env:LOCALAPPDATA\GitHubDesktop" `
        -Filter "git.exe" `
        -Recurse `
        -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -match '\\resources\\app\\git\\cmd\\git\.exe$'
        } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($desktopGit) {
        return $desktopGit.FullName
    }

    return $null
}

function Restore-Repository($git) {
    Write-Host "変更を適用前の状態へ戻しています..." -ForegroundColor Yellow
    & $git reset --hard HEAD | Out-Null
    & $git clean -fd | Out-Null
}

Write-Step "更新準備"

if (-not (Test-Path ".git")) {
    Stop-WithMessage "このファイルをvoid-survivorsリポジトリ内で実行してください。"
}

$git = Find-Git

if (-not $git) {
    Stop-WithMessage "Gitが見つかりません。GitHub Desktopがインストールされているか確認してください。"
}

$currentChanges = & $git status --porcelain

if ($currentChanges) {
    Write-Host "未保存の変更があります:" -ForegroundColor Yellow
    Write-Host $currentChanges
    Stop-WithMessage "安全のため中止しました。先にGitHub Desktopで変更をCommitまたは破棄してください。"
}

Write-Step "クリップボードを確認"

try {
    $clipboard = Get-Clipboard -Raw
} catch {
    Stop-WithMessage "クリップボードを読み取れませんでした。"
}

if ([string]::IsNullOrWhiteSpace($clipboard)) {
    Stop-WithMessage "クリップボードが空です。ChatGPTの更新パッチをコピーしてください。"
}

$clipboard = $clipboard.Replace("`r`n", "`n")

$commitMessage = "Update VOID SURVIVORS"

if ($clipboard -match '(?m)^# COMMIT:\s*(.+)$') {
    $commitMessage = $Matches[1].Trim()
    $clipboard = [regex]::Replace(
        $clipboard,
        '(?m)^# COMMIT:.*\n?',
        "",
        1
    )
}

if ($clipboard -notmatch '(?m)^diff --git ') {
    Stop-WithMessage "有効な更新パッチではありません。先頭付近に「diff --git」が必要です。"
}

$patchPath = Join-Path $env:TEMP "void-survivors-update.patch"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($patchPath, $clipboard, $utf8)

Write-Step "パッチを検証"

& $git apply --check --whitespace=nowarn $patchPath

if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "パッチを適用できませんでした。ゲームが想定と異なる版になっている可能性があります。"
}

Write-Step "更新を適用"

& $git apply --whitespace=nowarn $patchPath

if ($LASTEXITCODE -ne 0) {
    Restore-Repository $git
    Stop-WithMessage "更新中に問題が発生したため、元の状態へ戻しました。"
}

Write-Step "ファイルを検査"

& $git diff --check

if ($LASTEXITCODE -ne 0) {
    Restore-Repository $git
    Stop-WithMessage "ファイル内に不正な空白や競合が見つかったため、元の状態へ戻しました。"
}

$node = Get-Command node -ErrorAction SilentlyContinue

if ($node -and (Test-Path "assets\js\game.js")) {
    & $node.Source --check "assets\js\game.js"

    if ($LASTEXITCODE -ne 0) {
        Restore-Repository $git
        Stop-WithMessage "JavaScriptの構文エラーが見つかったため、元の状態へ戻しました。"
    }

    Write-Host "JavaScript構文チェック: OK" -ForegroundColor Green
} else {
    Write-Host "Node.jsがないためJavaScript構文チェックは省略しました。" -ForegroundColor Yellow
}

$changedFiles = & $git diff --name-only

if (-not $changedFiles) {
    Stop-WithMessage "適用後の変更がありませんでした。"
}

Write-Host ""
Write-Host "変更ファイル:" -ForegroundColor Green
$changedFiles | ForEach-Object {
    Write-Host "  $_"
}

Write-Step "GitHubへ保存"

& $git add -A

& $git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "Commitに失敗しました。GitHub Desktopを確認してください。"
}

$branch = (& $git branch --show-current).Trim()

if ([string]::IsNullOrWhiteSpace($branch)) {
    $branch = "main"
}

& $git push origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "更新とCommitは完了しましたが、Pushに失敗しました。" -ForegroundColor Yellow
    Write-Host "GitHub Desktopで「Push origin」を押してください。"
    exit 0
}

Remove-Item $patchPath -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "更新完了！" -ForegroundColor Green
Write-Host "GitHub Pagesへ反映されるまで少し待ってから再読み込みしてください。"
Write-Host ""
Write-Host "ゲームURL:"
Write-Host "https://ryomashibaba.github.io/void-survivors/"