# Deployment Guide

This guide covers various deployment options for Ignition Layout Studio.

## Table of Contents
1. [Development Deployment](#development-deployment)
2. [Docker Deployment](#docker-deployment)
3. [Production Deployment](#production-deployment)
4. [Windows Deployment](#windows-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [Configuration](#configuration)
7. [Security](#security)
8. [Monitoring](#monitoring)

## Development Deployment

### Quick Start
```bash
# Clone repository
git clone https://github.com/your-org/ignition-layout-studio.git
cd ignition-layout-studio

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start development servers
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
cd frontend && npm start
```

### Development URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- WebSocket: ws://localhost:5000

## Docker Deployment

### Using Docker Compose

1. **Basic deployment**:
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

2. **Production deployment with nginx**:
```bash
# Start with production profile
docker-compose --profile production up -d
```

### Building Docker Image

```bash
# Build image
docker build -t ignition-layout-studio:latest .

# Run container
docker run -d \
  -p 5000:5000 \
  -v $(pwd)/data:/app/data \
  --name ignition-studio \
  ignition-layout-studio:latest
```

### Docker Environment Variables

Create `.env` file:
```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://your-domain.com
PADDLE_OCR_MCP_PATH=/usr/local/bin/paddleocr-mcp
```

## Production Deployment

### Prerequisites
- Node.js 16+ 
- PM2 (process manager)
- Nginx (reverse proxy)
- SSL certificates

### Step 1: Build Frontend
```bash
cd frontend
npm run build
```

### Step 2: Setup PM2
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'ignition-studio',
    script: './backend/src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### Step 3: Configure Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 4: Enable and Start Services
```bash
# Reload nginx
sudo nginx -s reload

# Check PM2 status
pm2 status
```

## Windows Deployment

### Using Node.js

1. **Install Node.js** from nodejs.org

2. **Setup as Windows Service**:
```powershell
# Install node-windows
npm install -g node-windows

# Create service script
node install-windows-service.js
```

3. **Configure IIS** (optional):
   - Install IIS with URL Rewrite module
   - Configure reverse proxy to Node.js application

### Using Docker Desktop

1. Install Docker Desktop for Windows
2. Use same Docker commands as Linux deployment

## Cloud Deployment

### AWS EC2

1. **Launch EC2 Instance**:
   - Ubuntu 20.04 LTS
   - t3.medium or larger
   - Security group: ports 80, 443, 22

2. **Install Dependencies**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install nginx
sudo apt install nginx -y

# Install certbot for SSL
sudo snap install --classic certbot
```

3. **Deploy Application**:
```bash
# Clone repository
git clone https://github.com/your-org/ignition-layout-studio.git

# Install and build
cd ignition-layout-studio
npm install --prefix backend
npm install --prefix frontend
npm run build --prefix frontend

# Setup PM2
sudo npm install -g pm2
pm2 start ecosystem.config.js
```

### Azure App Service

1. **Create App Service**:
```bash
# Create resource group
az group create --name ignition-rg --location eastus

# Create app service plan
az appservice plan create \
  --name ignition-plan \
  --resource-group ignition-rg \
  --sku B2

# Create web app
az webapp create \
  --name ignition-studio \
  --resource-group ignition-rg \
  --plan ignition-plan \
  --runtime "NODE|16-lts"
```

2. **Deploy with Git**:
```bash
# Configure deployment
az webapp deployment source config-local-git \
  --name ignition-studio \
  --resource-group ignition-rg

# Push to Azure
git remote add azure <deployment-url>
git push azure main
```

### Google Cloud Run

1. **Build Container**:
```bash
# Build and tag
docker build -t gcr.io/PROJECT-ID/ignition-studio .

# Push to registry
docker push gcr.io/PROJECT-ID/ignition-studio
```

2. **Deploy to Cloud Run**:
```bash
gcloud run deploy ignition-studio \
  --image gcr.io/PROJECT-ID/ignition-studio \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 5000 |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:3000 |
| PADDLE_OCR_MCP_PATH | Path to PaddleOCR MCP | - |
| MAX_FILE_SIZE | Maximum upload size | 100MB |
| SESSION_SECRET | Session encryption key | random |
| DATABASE_URL | Database connection | - |

### File Storage

Configure persistent storage for:
- `/uploads` - User uploaded files
- `/exports` - Generated exports
- `/projects` - Project data
- `/logs` - Application logs

### Database (Optional)

For large deployments, consider using a database:

```javascript
// PostgreSQL configuration
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

## Security

### SSL/TLS Configuration

1. **Obtain SSL Certificate**:
```bash
# Using Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

2. **Configure Strong Ciphers**:
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
```

### Security Headers

Add to nginx configuration:
```nginx
add_header Strict-Transport-Security "max-age=63072000" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### Authentication (Optional)

Implement authentication middleware:
```javascript
// Example with JWT
const jwt = require('jsonwebtoken');

app.use('/api/*', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
```

## Monitoring

### Application Monitoring

1. **PM2 Monitoring**:
```bash
# View real-time logs
pm2 logs

# Monitor resources
pm2 monit

# Web dashboard
pm2 web
```

2. **Health Checks**:
```bash
# Setup health check endpoint monitoring
curl http://your-domain.com/api/health
```

### Log Management

1. **Configure Log Rotation**:
```bash
# /etc/logrotate.d/ignition-studio
/var/log/ignition-studio/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

2. **Centralized Logging** (optional):
- ELK Stack (Elasticsearch, Logstash, Kibana)
- CloudWatch (AWS)
- Stackdriver (GCP)
- Application Insights (Azure)

### Performance Monitoring

1. **New Relic Integration**:
```javascript
// Add to server.js
if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}
```

2. **Custom Metrics**:
```javascript
// Track response times
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
  });
  next();
});
```

## Backup and Recovery

### Automated Backups

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups/ignition-studio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup data directories
tar -czf "$BACKUP_DIR/data_$TIMESTAMP.tar.gz" \
  /app/data/uploads \
  /app/data/exports \
  /app/data/projects

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### Disaster Recovery

1. **Regular backups** to off-site storage
2. **Database replication** if using database
3. **Container registry** for Docker images
4. **Infrastructure as Code** for quick rebuilds

## Troubleshooting

### Common Issues

1. **Port already in use**:
```bash
# Find process using port
lsof -i :5000
# Kill process
kill -9 <PID>
```

2. **Permission errors**:
```bash
# Fix permissions
sudo chown -R $USER:$USER /app
chmod -R 755 /app/data
```

3. **Memory issues**:
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm start
```