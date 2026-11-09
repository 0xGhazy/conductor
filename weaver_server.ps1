# Weaver Server Startup Script for Windows PowerShell
# Downloads the server JAR if missing and starts it with java
#
# Usage:
#   Interactive:  .\weaver_server.ps1
#   With args:    .\weaver_server.ps1 -Port 9090 -Version 3.22.0
#   One-liner:    irm ... | iex

param(
    [string]$Port,
    [string]$Version
)

$REPO_URL = "https://weaver-server.s3.us-east-2.amazonaws.com"

# Check for Java and version 21+
try {
    $javaVersionOutput = & java -version 2>&1 | Select-Object -First 1
    if ($javaVersionOutput -match '"(\d+)') {
        $javaMajor = [int]$Matches[1]
        if ($javaMajor -lt 21) {
            Write-Host "Error: JDK 21 or higher is required. Current version: $javaVersionOutput"
            exit 1
        }
    } else {
        Write-Host "Error: Unable to determine Java version"
        exit 1
    }
} catch {
    Write-Host "Error: Java is not installed or not in PATH"
    exit 1
}

# Determine Port
if (-not [string]::IsNullOrEmpty($Port)) {
    $SERVER_PORT = $Port
} elseif (-not [string]::IsNullOrEmpty($env:WEAVER_PORT)) {
    $SERVER_PORT = $env:WEAVER_PORT
} elseif ([Environment]::UserInteractive) {
    try {
        # Check if we are running effectively non-interactively (e.g. piped input)
        # However [Environment]::UserInteractive is usually true in PS console.
        # We can try reading with timeout or just checking args.
        # If parameters were not passed, prompt.
        if ($PSBoundParameters.Count -eq 0) {
             $inputPort = Read-Host "Enter the port for Server [8080]"
             if (-not [string]::IsNullOrEmpty($inputPort)) { $SERVER_PORT = $inputPort }
             else { $SERVER_PORT = "8080" }
        } else {
             $SERVER_PORT = "8080"
        }
    } catch {
        $SERVER_PORT = "8080"
    }
} else {
    $SERVER_PORT = "8080"
}
# Fallback if logic above left it null (e.g. non-interactive, no params)
if ([string]::IsNullOrEmpty($SERVER_PORT)) { $SERVER_PORT = "8080" }


# Determine Version
$WEAVER_VERSION = "latest"
if (-not [string]::IsNullOrEmpty($Version)) {
    $WEAVER_VERSION = $Version
} elseif ([Environment]::UserInteractive -and $PSBoundParameters.Count -eq 0) {
     $inputVersion = Read-Host "Enter the version [latest]"
     if (-not [string]::IsNullOrEmpty($inputVersion)) { $WEAVER_VERSION = $inputVersion }
}

$JAR_NAME = "weaver-server-$WEAVER_VERSION.jar"
$JAR_URL = "$REPO_URL/$JAR_NAME"

# Use Weaver_HOME if set, otherwise use current directory
if ([string]::IsNullOrEmpty($env:Weaver_HOME)) {
    $Weaver_HOME = "."
} else {
    $Weaver_HOME = $env:Weaver_HOME
}

$JAR_PATH = Join-Path $Weaver_HOME $JAR_NAME

# Download JAR if not present
if (-not (Test-Path $JAR_PATH)) {
    Write-Host "Downloading Weaver Server $WEAVER_VERSION..."
    if (-not (Test-Path $Weaver_HOME)) {
        New-Item -ItemType Directory -Path $Weaver_HOME -Force | Out-Null
    }
    try {
        Invoke-WebRequest -Uri $JAR_URL -OutFile $JAR_PATH
        Write-Host "Downloaded to $JAR_PATH"
    } catch {
        Write-Host "Failed to download Weaver Server JAR: $_"
        exit 1
    }
}

Write-Host "Starting Weaver Server $WEAVER_VERSION on port $SERVER_PORT..."
java -jar $JAR_PATH --server.port=$SERVER_PORT
