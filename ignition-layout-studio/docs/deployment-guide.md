# Deployment Guide

This guide covers deploying the Ignition Layout Studio with all advanced features including database integration, authentication, and performance monitoring.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Python 3.9+
- Docker (optional)
- Git

## Environment Setup

### 1. Database Setup

#### PostgreSQL Installation
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql

# Windows
# Download and install from https://www.postgresql.org/download/windows/
```

#### Database Configuration
```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE ignition_layout_studio;
CREATE USER ignition_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE ignition_layout_studio TO ignition_user;
\q
```

### 2. Environment Variables

Create `.env` file in the backend directory:

```env
# Server Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-domain.com

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=ignition_user
DB_PASSWORD=secure_password
DB_NAME=ignition_layout_studio
DB_SSL=true

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_REFRESH_EXPIRES_IN=30d

# AI Service Configuration
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
AI_PROVIDER=openai
AI_MODEL=gpt-4

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_ALERT_THRESHOLD_RESPONSE_TIME=2000
PERFORMANCE_ALERT_THRESHOLD_ERROR_RATE=0.05

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
HELMET_ENABLED=true

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

#### 1. Build and Run with Docker Compose
```bash
# Clone repository
git clone https://github.com/your-org/ignition-layout-studio.git
cd ignition-layout-studio

# Create environment file
cp .env.template .env
# Edit .env with your configuration

# Build and start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

#### 2. Docker Compose Configuration
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: ignition_layout_studio
      POSTGRES_USER: ignition_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
    depends_on:
      - postgres
    restart: unless-stopped
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./frontend/build:/usr/share/nginx/html
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

### Method 2: Manual Deployment

#### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm ci --production

# Run database migrations
npm run db:migrate

# Start backend server
npm start
```

#### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm ci

# Build for production
npm run build

# Serve with nginx or serve
npx serve -s build -l 3000
```

#### 3. Process Management with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start backend with PM2
cd backend
pm2 start src/server.js --name "ignition-backend"

# Start frontend with PM2
cd ../frontend
pm2 serve build 3000 --name "ignition-frontend"

# Save PM2 configuration
pm2 save
pm2 startup
```

## Production Configuration

### 1. Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Frontend
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. SSL Certificate Setup
```bash
# Using Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Or using custom certificate
sudo mkdir -p /etc/nginx/ssl
sudo cp your-cert.pem /etc/nginx/ssl/cert.pem
sudo cp your-key.pem /etc/nginx/ssl/key.pem
```

## Database Management

### 1. Database Migrations
```bash
# Run migrations
npm run db:migrate

# Rollback migrations
npm run db:rollback

# Create new migration
npm run db:create-migration migration-name
```

### 2. Database Backup
```bash
# Create backup
pg_dump -U ignition_user -h localhost ignition_layout_studio > backup.sql

# Restore backup
psql -U ignition_user -h localhost ignition_layout_studio < backup.sql
```

### 3. Database Monitoring
```bash
# Check database connections
SELECT * FROM pg_stat_activity;

# Check database size
SELECT pg_database.datname, pg_database_size(pg_database.datname) 
FROM pg_database;

# Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## Performance Monitoring

### 1. Application Metrics
The application includes built-in performance monitoring:

- **Response Time Monitoring**: Tracks API response times
- **Error Rate Monitoring**: Monitors application errors
- **System Resource Monitoring**: CPU, memory, disk usage
- **Database Performance**: Query times and connection counts

### 2. Accessing Metrics
```bash
# Get current metrics
curl http://localhost:3001/api/metrics

# Get performance summary
curl http://localhost:3001/api/metrics/summary

# Get performance report
curl http://localhost:3001/api/metrics/report?timeRange=24h
```

### 3. External Monitoring Integration
```bash
# Datadog integration
export DATADOG_API_KEY=your-datadog-key

# New Relic integration
export NEW_RELIC_LICENSE_KEY=your-newrelic-key

# Sentry integration
export SENTRY_DSN=your-sentry-dsn
```

## Security Configuration

### 1. Authentication Setup
```bash
# Create admin user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@yourcompany.com",
    "password": "SecurePassword123!",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }'
```

### 2. Security Headers
The application automatically includes security headers:
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Content Security Policy

### 3. Rate Limiting
Built-in rate limiting:
- General API: 100 requests/15 minutes
- Authentication: 10 requests/15 minutes
- Login attempts: 5 requests/15 minutes

## Backup and Recovery

### 1. Automated Backups
```bash
# Setup automated database backups
crontab -e

# Add backup job (daily at 2 AM)
0 2 * * * /usr/bin/pg_dump -U ignition_user ignition_layout_studio > /backups/db-$(date +\%Y\%m\%d).sql
```

### 2. File Backups
```bash
# Backup uploaded files
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

## Monitoring and Maintenance

### 1. Health Checks
```bash
# Application health
curl http://localhost:3001/api/health

# Database health
curl http://localhost:3001/api/health/database

# System health
curl http://localhost:3001/api/health/system
```

### 2. Log Monitoring
```bash
# View application logs
tail -f logs/app.log

# View error logs
tail -f logs/error.log

# View access logs
tail -f logs/access.log
```

### 3. Performance Monitoring
```bash
# Check system resources
htop

# Check disk usage
df -h

# Check memory usage
free -h

# Check database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -U ignition_user -h localhost -d ignition_layout_studio

# Check logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 2. High Memory Usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Restart services if needed
pm2 restart all
```

#### 3. Performance Issues
```bash
# Check slow queries
curl http://localhost:3001/api/metrics/slow-queries

# Check system metrics
curl http://localhost:3001/api/metrics/system

# Check error rates
curl http://localhost:3001/api/metrics/errors
```

## Scaling Considerations

### 1. Horizontal Scaling
- Use load balancer (nginx, HAProxy)
- Scale backend instances with PM2 cluster mode
- Implement session storage (Redis)
- Use CDN for static assets

### 2. Database Scaling
- Implement read replicas
- Use connection pooling
- Optimize queries and indexes
- Consider database sharding for large datasets

### 3. Caching Strategy
- Implement Redis for session storage
- Use application-level caching
- Implement CDN for static assets
- Cache database queries

## Updates and Maintenance

### 1. Application Updates
```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm ci

# Run migrations
npm run db:migrate

# Restart services
pm2 restart all
```

### 2. Security Updates
```bash
# Check for vulnerabilities
npm audit

# Update packages
npm update

# Check Docker images
docker images
docker pull postgres:14
```

This deployment guide provides comprehensive instructions for deploying the Ignition Layout Studio with all advanced features. Follow the appropriate method based on your infrastructure requirements.