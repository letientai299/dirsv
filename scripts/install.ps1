#Requires -Version 5.1
<#
.SYNOPSIS
    Download and install dirsv from GitHub.

.DESCRIPTION
    Downloads the latest release or main branch build of dirsv and installs it
    to the specified directory. Works with both PowerShell 5.1 and PowerShell 7+.

.PARAMETER FromMain
    Download the latest successful build from the main branch instead of the
    latest release. Requires GitHub CLI (gh) to be installed and authenticated.

.PARAMETER InstallDir
    Installation directory. Defaults to ~\bin on Windows or ~/.local/bin on
    Unix-like systems.

.EXAMPLE
    .\install.ps1
    Install the latest release to the default directory.

.EXAMPLE
    .\install.ps1 -FromMain
    Install the latest build from main branch.

.EXAMPLE
    .\install.ps1 -InstallDir "C:\Tools"
    Install to a custom directory.
#>

[CmdletBinding()]
param(
    [Alias("m")]
    [switch]$FromMain,

    [Alias("d")]
    [string]$InstallDir
)

$ErrorActionPreference = "Stop"

$Repo = "tai/dirsv"
$BinaryName = "dirsv"

# --- Platform detection (PS5 + PS7) ---

function Get-Platform {
    # OS detection: PS5 lacks $IsWindows/$IsLinux/$IsMacOS
    $os = if ($PSVersionTable.PSVersion.Major -le 5) {
        "windows"
    }
    elseif ($IsWindows) {
        "windows"
    }
    elseif ($IsLinux) {
        "linux"
    }
    elseif ($IsMacOS) {
        "darwin"
    }
    else {
        throw "Unsupported operating system"
    }

    # Architecture detection: RuntimeInformation may be unavailable on PS5
    $archStr = $null
    try {
        $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
        $archStr = switch ($arch) {
            "X64" { "amd64" }
            "Arm64" { "arm64" }
            default { $null }
        }
    }
    catch {
        # Fallback for PS5 / older .NET Framework
    }

    if (-not $archStr) {
        $archStr = switch ($env:PROCESSOR_ARCHITECTURE) {
            "AMD64" { "amd64" }
            "ARM64" { "arm64" }
            default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
        }
    }

    return "$os-$archStr"
}

$Platform = Get-Platform
$IsWindowsPlatform = $Platform -like "windows-*"
$ArchiveExt = if ($IsWindowsPlatform) { "zip" } else { "tar.gz" }
$BinaryExt = if ($IsWindowsPlatform) { ".exe" } else { "" }
$ArtifactName = "$BinaryName-$Platform"

if (-not $InstallDir) {
    $InstallDir = if ($IsWindowsPlatform) {
        Join-Path $env:USERPROFILE "bin"
    }
    else {
        Join-Path $env:HOME ".local/bin"
    }
}

# --- Logging ---

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fatal {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

# --- Download helpers ---

function Get-LatestRelease {
    Write-Info "Fetching latest release..."

    $releaseUrl = "https://api.github.com/repos/$Repo/releases/latest"
    $release = Invoke-RestMethod -Uri $releaseUrl -UseBasicParsing

    $assetName = "$ArtifactName.$ArchiveExt"
    $asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1

    if (-not $asset) {
        Write-Fatal "Could not find release artifact: $assetName"
    }

    $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) $assetName

    Write-Info "Downloading $assetName..."
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tempFile -UseBasicParsing

    return $tempFile
}

function Get-FromMain {
    Write-Info "Fetching latest successful build from main branch..."

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Fatal "GitHub CLI (gh) is required for -FromMain. Install from: https://cli.github.com/"
    }

    $null = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fatal "GitHub CLI not authenticated. Run: gh auth login"
    }

    $runJson = gh run list --repo $Repo --branch main --workflow release.yml --status success --limit 1 --json databaseId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fatal "Failed to fetch workflow runs: $runJson"
    }

    $runs = $runJson | ConvertFrom-Json
    if (-not $runs -or $runs.Count -eq 0) {
        Write-Fatal "No successful workflow runs found on main branch"
    }

    $runId = $runs[0].databaseId
    Write-Info "Found workflow run: $runId"

    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "dirsv-download-$PID"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    Write-Info "Downloading artifact: $ArtifactName..."
    gh run download $runId --repo $Repo --name $ArtifactName --dir $tempDir

    if ($LASTEXITCODE -ne 0) {
        Write-Fatal "Failed to download artifact"
    }

    $archive = Get-ChildItem -Path $tempDir -Filter "*.$ArchiveExt" -Recurse |
        Select-Object -First 1

    if (-not $archive) {
        Write-Fatal "Could not find downloaded archive in $tempDir"
    }

    return $archive.FullName
}

# --- Install ---

function Install-Binary {
    param(
        [string]$Archive,
        [string]$DestDir
    )

    Write-Info "Extracting archive..."

    $tempExtract = Join-Path ([System.IO.Path]::GetTempPath()) "dirsv-extract-$PID"
    New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null

    if ($Archive -like "*.tar.gz") {
        tar -xzf $Archive -C $tempExtract
    }
    else {
        Expand-Archive -Path $Archive -DestinationPath $tempExtract -Force
    }

    $binaryFileName = "$BinaryName$BinaryExt"
    $binary = Get-ChildItem -Path $tempExtract -Filter $binaryFileName -Recurse |
        Select-Object -First 1

    if (-not $binary) {
        Write-Fatal "Could not find $binaryFileName in archive"
    }

    if (-not (Test-Path $DestDir)) {
        Write-Info "Creating directory: $DestDir"
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    }

    $destPath = Join-Path $DestDir $binaryFileName
    Write-Info "Installing to $destPath..."
    Copy-Item -Path $binary.FullName -Destination $destPath -Force

    if (-not $IsWindowsPlatform) {
        chmod +x $destPath
    }

    # Cleanup
    Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $Archive -Force -ErrorAction SilentlyContinue

    Write-Info "Successfully installed $BinaryName to $destPath"

    # PATH check
    $pathSep = if ($IsWindowsPlatform) { ";" } else { ":" }
    $pathDirs = $env:PATH -split [regex]::Escape($pathSep)
    if ($pathDirs -notcontains $DestDir) {
        Write-Warn "$DestDir is not in your PATH"
        if ($IsWindowsPlatform) {
            Write-Warn "To add permanently:"
            Write-Warn "  [Environment]::SetEnvironmentVariable('PATH', `$env:PATH + ';$DestDir', 'User')"
        }
        else {
            Write-Warn "Add to your shell profile:"
            Write-Warn "  export PATH=`"`$PATH:$DestDir`""
        }
    }
}

# --- Main ---

try {
    Write-Info "Platform: $Platform"

    $archive = if ($FromMain) {
        Get-FromMain
    }
    else {
        Get-LatestRelease
    }

    Install-Binary -Archive $archive -DestDir $InstallDir
}
catch {
    Write-Fatal $_.Exception.Message
}
