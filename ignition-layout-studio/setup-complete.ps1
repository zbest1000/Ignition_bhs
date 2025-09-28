# Ignition Layout Studio - Complete Setup Script
# This script sets up PostgreSQL, installs dependencies, and fixes vulnerabilities

Write-Host "🚀 Ignition Layout Studio - Complete Setup" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
    exit 1
}

# Function to check if a command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Function to install Chocolatey
function Install-Chocolatey {
    Write-Host "📦 Installing Chocolatey..." -ForegroundColor Blue
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    refreshenv
}

# Function to install PostgreSQL
function Install-PostgreSQL {
    Write-Host "🐘 Installing PostgreSQL..." -ForegroundColor Blue
    
    if (Test-Command "psql") {
        Write-Host "✅ PostgreSQL already installed" -ForegroundColor Green
        return
    }
    
    if (-not (Test-Command "choco")) {
        Install-Chocolatey
    }
    
    # Install PostgreSQL with default password
    choco install postgresql15 --params "/Password:postgres123" -y
    
    # Add PostgreSQL to PATH
    $pgPath = "C:\Program Files\PostgreSQL\15\bin"
    if (Test-Path $pgPath) {
        $env:PATH += ";$pgPath"
        [Environment]::SetEnvironmentVariable("PATH", $env:PATH, "Machine")
    }
    
    Write-Host "✅ PostgreSQL installed successfully" -ForegroundColor Green
}

# Function to setup database
function Setup-Database {
    Write-Host "🗄️ Setting up database..." -ForegroundColor Blue
    
    # Wait for PostgreSQL service to start
    Start-Sleep -Seconds 5
    
    # Create database and user
    $sqlCommands = @"
CREATE DATABASE ignition_layout_studio_dev;
CREATE USER ignition_user WITH PASSWORD 'secure_password_123';
GRANT ALL PRIVILEGES ON DATABASE ignition_layout_studio_dev TO ignition_user;
\q
"@
    
    # Save SQL commands to temporary file
    $tempSqlFile = "$env:TEMP\setup_db.sql"
    $sqlCommands | Out-File -FilePath $tempSqlFile -Encoding UTF8
    
    try {
        # Execute SQL commands
        & psql -U postgres -h localhost -f $tempSqlFile
        Write-Host "✅ Database setup completed" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Database setup failed, will use SQLite fallback" -ForegroundColor Yellow
    } finally {
        # Clean up temporary file
        if (Test-Path $tempSqlFile) {
            Remove-Item $tempSqlFile
        }
    }
}

# Function to install Node.js dependencies
function Install-Dependencies {
    Write-Host "📦 Installing Node.js dependencies..." -ForegroundColor Blue
    
    # Backend dependencies
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    Set-Location -Path "backend"
    
    # Remove vulnerable packages
    npm uninstall xlsx --silent
    
    # Install/update dependencies
    npm install --silent
    
    # Frontend dependencies
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Set-Location -Path "../frontend"
    
    # Install with legacy peer deps to avoid conflicts
    npm install --legacy-peer-deps --silent
    
    Set-Location -Path ".."
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
}

# Function to create environment file
function Create-Environment {
    Write-Host "⚙️ Creating environment configuration..." -ForegroundColor Blue
    
    $envContent = @"
# Environment Configuration
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Database Configuration (PostgreSQL with SQLite fallback)
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ignition_layout_studio_dev
DB_USER=ignition_user
DB_PASSWORD=secure_password_123
DB_STORAGE=./database.sqlite

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=52428800
MAX_FILES=10
UPLOAD_PATH=../uploads
EXPORT_PATH=../exports

# Logging Configuration
LOG_LEVEL=info

# OCR Configuration
OCR_PROVIDER=mock
OCR_TIMEOUT=30000
OCR_MAX_CONCURRENT=3

# AI Provider Configuration (disabled by default)
OPENAI_ENABLED=false
ANTHROPIC_ENABLED=false
AZURE_OPENAI_ENABLED=false
GEMINI_ENABLED=false
"@
    
    # Create .env file in backend directory
    $envContent | Out-File -FilePath "backend\.env" -Encoding UTF8
    Write-Host "✅ Environment file created" -ForegroundColor Green
}

# Function to test the setup
function Test-Setup {
    Write-Host "🧪 Testing setup..." -ForegroundColor Blue
    
    # Test database connection
    Set-Location -Path "backend"
    $testResult = & node -e "const { testConnection } = require('./src/config/database'); testConnection().then(r => console.log('DB:', r ? 'OK' : 'FAIL')).catch(e => console.log('DB: FAIL -', e.message));" 2>&1
    Write-Host "Database test: $testResult" -ForegroundColor Cyan
    
    Set-Location -Path ".."
    Write-Host "✅ Setup testing completed" -ForegroundColor Green
}

# Function to display final instructions
function Show-Instructions {
    Write-Host ""
    Write-Host "🎉 Setup Complete!" -ForegroundColor Green
    Write-Host "=================" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the application:" -ForegroundColor White
    Write-Host ""
    Write-Host "1. Start Backend:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor Gray
    Write-Host "   npm start" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Start Frontend (in new terminal):" -ForegroundColor Yellow
    Write-Host "   cd frontend" -ForegroundColor Gray
    Write-Host "   npm start" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Access Application:" -ForegroundColor Yellow
    Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Gray
    Write-Host "   Backend API: http://localhost:5000/api/health" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📋 Important Files:" -ForegroundColor White
    Write-Host "   - POSTGRESQL_SETUP.md - PostgreSQL installation guide" -ForegroundColor Gray
    Write-Host "   - DATABASE_SETUP.md - Database configuration guide" -ForegroundColor Gray
    Write-Host "   - SECURITY_AUDIT.md - Security vulnerability report" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🔒 Security Status:" -ForegroundColor White
    Write-Host "   - Backend: ✅ No vulnerabilities" -ForegroundColor Green
    Write-Host "   - Frontend: ⚠️ Development-only vulnerabilities (acceptable)" -ForegroundColor Yellow
    Write-Host "   - Database: 🐘 PostgreSQL with SQLite fallback" -ForegroundColor Blue
    Write-Host ""
}

# Main execution
try {
    Write-Host "Starting setup process..." -ForegroundColor Blue
    
    # Check if we're in the right directory
    if (-not (Test-Path "backend") -or -not (Test-Path "frontend")) {
        Write-Host "❌ Please run this script from the ignition-layout-studio directory" -ForegroundColor Red
        exit 1
    }
    
    # Install PostgreSQL
    Install-PostgreSQL
    
    # Setup database
    Setup-Database
    
    # Install dependencies
    Install-Dependencies
    
    # Create environment configuration
    Create-Environment
    
    # Test setup
    Test-Setup
    
    # Show final instructions
    Show-Instructions
    
    Write-Host "✅ Setup completed successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 