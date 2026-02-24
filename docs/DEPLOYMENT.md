# Deployment Guide

Guide for deploying and running the application.

## Server Deployment

### Requirements

- Node.js 18+
- Pi coding agent: `npm i -g @mariozechner/pi-coding-agent`
- (Optional) PM2 or similar for process management
- (Optional) Nginx for reverse proxy

### Basic Deployment

```bash
# Clone repository
git clone <repo-url>
cd vibe-coding-everywhere

# Install dependencies
npm install

# Set environment variables
export WORKSPACE=/path/to/your/project
export PORT=3456

# Start server
npm start
```

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'claude-terminal',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3456,
      WORKSPACE: '/path/to/workspace'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3456

ENV PORT=3456
ENV WORKSPACE=/workspace

CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t claude-terminal .
docker run -p 3456:3456 -v /path/to/project:/workspace claude-terminal
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/claude-terminal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Mobile App Distribution

### Prerequisites

- Expo account
- Apple Developer account (for iOS)
- Google Play Developer account (for Android)

### Build Configuration

Update `apps/mobile/app.json`:

```json
{
  "expo": {
    "name": "Claude Terminal",
    "slug": "claude-terminal",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.claudeterminal"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.yourcompany.claudeterminal"
    }
  }
}
```

### iOS Build

```bash
cd apps/mobile

# Build with EAS
npm install -g eas-cli
eas login

# Configure build
eas build:configure

# Build for App Store
eas build --platform ios --profile production

# Or build locally
npm run ios
```

### Android Build

```bash
cd apps/mobile

# Build with EAS
eas build --platform android --profile production

# Or build locally
npm run android
```

## OpenZiti Setup (Mobile Overlay)

For remote mobile access without a VPN app on the device, use the OpenZiti overlay. See `scripts/setup-ziti-network.sh` and `scripts/start-mobile-ziti.mjs` for setup. Set `OVERLAY_NETWORK=ziti` and run `npm run dev:ziti` with the mobile app started via `npm run dev:mobile:ziti`.

## Security Considerations

### Server Security

1. **Firewall**: Only expose necessary ports
2. **Authentication**: Add auth if exposing to internet
3. **HTTPS**: Use TLS in production
4. **Workspace isolation**: Verify path sanitization

### Environment Variables

Store secrets securely:

```bash
# Use .env file (not committed)
cat > .env << 'EOF'
PORT=3456
WORKSPACE=/safe/path
EOF

# Or use secret management
export $(grep -v '^#' .env | xargs)
```

### AI Provider Configuration

**Claude permissions:**

```bash
# For trusted environments
DEFAULT_PERMISSION_MODE=bypassPermissions

# For restrictive environments  
DEFAULT_PERMISSION_MODE=acceptEdits
```

**Provider selection and Gemini approval:**

```bash
# Use Claude
DEFAULT_PROVIDER=claude

# Use Gemini (default)
DEFAULT_PROVIDER=gemini
DEFAULT_GEMINI_APPROVAL_MODE=auto_edit   # or default, plan
```

## Monitoring

### Server Logs

```bash
# View logs
pm2 logs claude-terminal

# Or tail log files
tail -f logs/claude/claude-output-*.log
tail -f logs/gemini/gemini-output-*.log
```

### Health Checks

```bash
# Check server health
curl http://localhost:3456/api/config

# Check workspace
curl http://localhost:3456/api/workspace-path
```

### Metrics

Add monitoring with PM2:

```bash
pm2 monit

# Or use web interface
pm2 plus
```

## Backup and Recovery

### What to Backup

- AI output logs (`logs/claude/`, `logs/gemini/`)
- Workspace files
- Configuration files

### Automated Backups

```bash
# Daily backup script
cat > /usr/local/bin/backup-claude.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf /backups/claude-$DATE.tar.gz logs/ workspace/
find /backups -name "claude-*.tar.gz" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-claude.sh

# Add to crontab
0 2 * * * /usr/local/bin/backup-claude.sh
```

## Troubleshooting

### Server Won't Start

```bash
# Check port availability
lsof -i :3456

# Check node version
node --version

# Check AI CLI installation
which claude && claude --version
which gemini && gemini --version
```

### Mobile Can't Connect

```bash
# Check firewall
sudo ufw status

# Test from another device (use your server host or Ziti overlay URL)
curl http://your-server:3456/api/config
```

### Performance Issues

```bash
# Check CPU/memory
htop

# Check disk space
df -h

# Restart server
pm2 restart claude-terminal
```

## Scaling

### Multiple Workspaces

Run multiple instances:

```bash
# Instance 1
PORT=3456 WORKSPACE=/project1 npm start

# Instance 2
PORT=3457 WORKSPACE=/project2 npm start
```

### Load Balancing

Use Nginx upstream:

```nginx
upstream claude_backend {
    server localhost:3456;
    server localhost:3457;
}

server {
    location / {
        proxy_pass http://claude_backend;
    }
}
```
