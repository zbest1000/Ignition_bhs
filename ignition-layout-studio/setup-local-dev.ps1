# PowerShell script for local setup of Ignition Layout Studio
$ErrorActionPreference = 'Stop'

# Go to script directory
Set-Location "$PSScriptRoot"

# Install backend dependencies
Set-Location "./backend"
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..."
    npm install
} else {
    Write-Host "Backend dependencies already installed."
}

# Ensure nodemon is installed locally
if (-not (Test-Path "./node_modules/.bin/nodemon")) {
    Write-Host "Installing nodemon locally..."
    npm install nodemon
} else {
    Write-Host "nodemon already installed locally."
}

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "No .env file found in backend. Creating a template .env..."
    @"
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
MAX_FILE_SIZE=100MB
OCR_LANGUAGE=eng
OCR_CONFIDENCE=0.7
OCR_PREPROCESSING=true
"@ | Set-Content .env
    Write-Host ".env file created. Please review and edit as needed."
} else {
    Write-Host ".env file already exists."
}

# Start backend in a new PowerShell window
$backendPath = Get-Location
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location `"$backendPath`"; npm run dev"

# Install frontend dependencies
Set-Location "../frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..."
    npm install
} else {
    Write-Host "Frontend dependencies already installed."
}

# Start frontend in this window
Write-Host "Starting frontend server..."
npm start 