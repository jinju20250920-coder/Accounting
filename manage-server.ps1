<#
.SYNOPSIS
AI Finance Assistant Server Manager - Advanced server management script

.DESCRIPTION
Manages the Next.js development server for AI Finance Assistant
- Stops only Node.js processes related to Next.js server
- Starts development server in background
- Checks server status without affecting other processes
- Safe for use with Visual Studio

.EXAMPLE
.\manage-server.ps1 -Action Stop
Stops the development server

.EXAMPLE
.\manage-server.ps1 -Action Start
Starts the development server

.EXAMPLE
.\manage-server.ps1 -Action Restart
Restarts the development server

.EXAMPLE
.\manage-server.ps1 -Action Status
Checks server status

#>

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("Start", "Stop", "Restart", "Status")]
    [string]$Action
)

function Get-ServerProcess {
    param (
        [switch]$IncludeChildren
    )

    try {
        # Find Next.js server processes (Node.js processes with Next.js specific arguments)
        $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue

        $serverProcesses = @()

        foreach ($process in $nodeProcesses) {
            $commandLine = Get-ProcessCommandLine $process.Id

            if ($commandLine -match "next.*dev" -or $commandLine -match "next-dev") {
                $serverProcesses += $process

                if ($IncludeChildren) {
                    $children = Get-ChildProcesses $process.Id
                    $serverProcesses += $children
                }
            }
        }

        return $serverProcesses | Select-Object -Unique
    } catch {
        return @()
    }
}

function Get-ProcessCommandLine {
    param (
        [int]$ProcessId
    )

    try {
        $wmiProcess = Get-WmiObject -Class Win32_Process -Filter "ProcessId = $ProcessId"
        return $wmiProcess.CommandLine
    } catch {
        return ""
    }
}

function Get-ChildProcesses {
    param (
        [int]$ParentId
    )

    try {
        $wmiProcesses = Get-WmiObject -Class Win32_Process -Filter "ParentProcessId = $ParentId"
        $children = @()

        foreach ($process in $wmiProcesses) {
            $children += Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue

            # Recursively find grandchild processes
            $grandchildren = Get-ChildProcesses $process.ProcessId
            $children += $grandchildren
        }

        return $children
    } catch {
        return @()
    }
}

function Stop-Server {
    Write-Host "`nStopping development server..." -ForegroundColor Yellow

    $processes = Get-ServerProcess -IncludeChildren

    if ($processes.Count -gt 0) {
        Write-Host "Found $($processes.Count) server-related process(es)" -ForegroundColor Yellow

        foreach ($process in $processes) {
            Write-Host "Stopping process $($process.Id) - $($process.ProcessName)"
            try {
                Stop-Process -Id $process.Id -Force -ErrorAction Stop
            } catch {
                Write-Host "Warning: Could not stop process $($process.Id): $_" -ForegroundColor Red
            }
        }

        Write-Host "Server stopped successfully!" -ForegroundColor Green
    } else {
        Write-Host "No server process found" -ForegroundColor Blue
    }
}

function Start-Server {
    Write-Host "`nStarting development server..." -ForegroundColor Yellow

    # Check if server is already running
    $existingProcesses = Get-ServerProcess
    if ($existingProcesses.Count -gt 0) {
        Write-Host "Server is already running (Process ID: $($existingProcesses[0].Id))" -ForegroundColor Blue
        return
    }

    try {
        # Start server in background
        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = "npm"
        $startInfo.Arguments = "run dev"
        $startInfo.WorkingDirectory = $PSScriptRoot
        $startInfo.WindowStyle = "Hidden"
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $startInfo
        $process.Start() | Out-Null

        Write-Host "Development server started successfully!" -ForegroundColor Green
        Write-Host "Open your browser and navigate to http://localhost:3000" -ForegroundColor Green
    } catch {
        Write-Host "Error starting server: $_" -ForegroundColor Red
    }
}

function Restart-Server {
    Write-Host "`nRestarting development server..." -ForegroundColor Yellow

    Stop-Server
    Start-Sleep -Seconds 2
    Start-Server
}

function Get-ServerStatus {
    Write-Host "`nChecking server status..." -ForegroundColor Yellow

    $processes = Get-ServerProcess

    if ($processes.Count -gt 0) {
        Write-Host "`n✅ Development server is RUNNING" -ForegroundColor Green
        Write-Host "  Process ID(s): $($processes | ForEach-Object { $_.Id })" -ForegroundColor Green
        Write-Host "  Navigate to: http://localhost:3000" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ Development server is NOT running" -ForegroundColor Yellow
        Write-Host "  Use 'Start' action to launch the server" -ForegroundColor Yellow
    }

    Write-Host ""
}

function Show-Menu {
    Clear-Host

    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "   AI Finance Assistant Server Manager" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "1. Stop development server" -ForegroundColor White
    Write-Host "2. Start development server" -ForegroundColor White
    Write-Host "3. Restart development server" -ForegroundColor White
    Write-Host "4. Check server status" -ForegroundColor White
    Write-Host "Q. Quit" -ForegroundColor White
    Write-Host ""
}

function Get-UserChoice {
    $choice = Read-Host "Enter your choice (1-4, Q to quit)"

    switch ($choice) {
        "1" { Stop-Server }
        "2" { Start-Server }
        "3" { Restart-Server }
        "4" { Get-ServerStatus }
        "Q" { return $false }
        "q" { return $false }
        default {
            Write-Host "`n❌ Invalid choice. Please enter a number between 1-4 or Q to quit." -ForegroundColor Red
        }
    }

    return $true
}

# Main execution
if (-not $Action) {
    # Interactive mode
    do {
        Show-Menu
        $continue = Get-UserChoice

        if ($continue -and $choice -notin @("Q", "q")) {
            Write-Host ""
            Read-Host "Press Enter to continue..." | Out-Null
        }
    } while ($continue)
} else {
    # Command line mode
    switch ($Action) {
        "Stop" { Stop-Server }
        "Start" { Start-Server }
        "Restart" { Restart-Server }
        "Status" { Get-ServerStatus }
    }
}

Write-Host "`nGoodbye!" -ForegroundColor Cyan