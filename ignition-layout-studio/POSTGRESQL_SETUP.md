# PostgreSQL Installation Guide

## Windows Installation

### Option 1: Official PostgreSQL Installer (Recommended)

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Download the latest stable version (15.x or 16.x)
   - Choose the Windows x86-64 installer

2. **Run the Installer**
   ```
   - Run the downloaded .exe file as Administrator
   - Choose installation directory (default: C:\Program Files\PostgreSQL\16)
   - Select components: PostgreSQL Server, pgAdmin 4, Command Line Tools
   - Set data directory (default: C:\Program Files\PostgreSQL\16\data)
   - Set superuser password (remember this!)
   - Set port (default: 5432)
   - Set locale (default: English, United States)
   ```

3. **Verify Installation**
   ```bash
   # Open Command Prompt as Administrator
   psql --version
   
   # Connect to PostgreSQL
   psql -U postgres -h localhost
   ```

### Option 2: Using Chocolatey

```bash
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install PostgreSQL
choco install postgresql --params '/Password:your_password'
```

### Option 3: Using Docker (Quick Setup)

```bash
# Pull and run PostgreSQL container
docker run --name postgres-ignition -e POSTGRES_PASSWORD=your_password -e POSTGRES_DB=ignition_layout_studio_dev -p 5432:5432 -d postgres:15

# Connect to container
docker exec -it postgres-ignition psql -U postgres -d ignition_layout_studio_dev
```

## Database Setup

### 1. Create Database and User

```sql
-- Connect as postgres superuser
psql -U postgres -h localhost

-- Create database
CREATE DATABASE ignition_layout_studio_dev;

-- Create user
CREATE USER ignition_user WITH PASSWORD 'secure_password_123';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ignition_layout_studio_dev TO ignition_user;

-- Exit
\q
```

### 2. Configure Environment Variables

Create `.env` file in `backend/` directory:

```env
# Database Configuration
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ignition_layout_studio_dev
DB_USER=ignition_user
DB_PASSWORD=secure_password_123

# Other required variables
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-minimum-32-characters
NODE_ENV=development
PORT=5000
```

### 3. Test Connection

```bash
# From backend directory
cd ignition-layout-studio/backend

# Test database connection
node -e "const { testConnection } = require('./src/config/database'); testConnection().then(r => console.log('Success:', r)).catch(e => console.log('Error:', e.message));"

# Start server
npm start
```

## Troubleshooting

### Common Issues

1. **Port 5432 already in use**
   ```bash
   # Check what's using port 5432
   netstat -an | findstr :5432
   
   # Stop PostgreSQL service
   net stop postgresql-x64-15
   ```

2. **Authentication failed**
   - Check username/password in .env file
   - Verify user has correct permissions
   - Check pg_hba.conf for authentication method

3. **Connection refused**
   - Ensure PostgreSQL service is running
   - Check firewall settings
   - Verify host and port settings

### Service Management

```bash
# Start PostgreSQL service
net start postgresql-x64-15

# Stop PostgreSQL service
net stop postgresql-x64-15

# Check service status
sc query postgresql-x64-15
```

## Security Best Practices

1. **Change default passwords**
2. **Use strong passwords (12+ characters)**
3. **Limit network access**
4. **Regular backups**
5. **Keep PostgreSQL updated**

## Backup and Restore

```bash
# Backup database
pg_dump -U ignition_user -h localhost ignition_layout_studio_dev > backup.sql

# Restore database
psql -U ignition_user -h localhost ignition_layout_studio_dev < backup.sql
``` 