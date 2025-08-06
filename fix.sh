#!/bin/bash

# Tạo thư mục nginx nếu chưa có
mkdir -p nginx

# Tạo file nginx.conf
cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=web:10m rate=30r/s;
    
    upstream api_backend {
        server api-server:3000;
    }
    
    server {
        listen 80;
        server_name _;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
        
        # Root directory for static files
        root /usr/share/nginx/html;
        index index.html;
        
        # Static files với cache
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # API proxy
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }
        
        # Health check endpoint
        location /health {
            proxy_pass http://api_backend/health;
            access_log off;
        }
        
        # Web interface
        location / {
            limit_req zone=web burst=50 nodelay;
            try_files $uri $uri/ /index.html;
        }
        
        # Handle favicon
        location = /favicon.ico {
            log_not_found off;
            access_log off;
            return 204;
        }
        
        # Error pages
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;
        
        location = /50x.html {
            root /usr/share/nginx/html;
        }
    }
}
EOF

# Tạo thư mục docker nếu cần (cho trường hợp frontend.Dockerfile tìm ở ../docker/)
mkdir -p docker
cp nginx/nginx.conf docker/nginx.conf

# Tạo thư mục web và file index.html cơ bản nếu chưa có
mkdir -p web
if [ ! -f web/index.html ]; then
    cat > web/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tailscale Automation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .loading { background: #e3f2fd; border-left: 4px solid #2196f3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Tailscale Automation System</h1>
        <div class="status loading">
            <strong>System Starting...</strong><br>
            Loading dashboard...
        </div>
        <script>
            // Basic health check
            fetch('/api/health')
                .then(r => r.json())
                .then(data => {
                    document.querySelector('.status').innerHTML = `
                        <strong>✅ System Online</strong><br>
                        API Status: ${data.status || 'OK'}<br>
                        <a href="/dashboard.html">Go to Dashboard</a>
                    `;
                    document.querySelector('.status').className = 'status success';
                    document.querySelector('.status').style.background = '#e8f5e8';
                    document.querySelector('.status').style.borderLeft = '4px solid #4caf50';
                })
                .catch(e => {
                    document.querySelector('.status').innerHTML = `
                        <strong>❌ API Connection Failed</strong><br>
                        Error: ${e.message}<br>
                        Please check if the API server is running.
                    `;
                    document.querySelector('.status').className = 'status error';
                    document.querySelector('.status').style.background = '#ffebee';
                    document.querySelector('.status').style.borderLeft = '4px solid #f44336';
                });
        </script>
    </div>
</body>
</html>
EOF
fi

# Tạo thư mục logs
mkdir -p logs

echo "✅ Created nginx configuration and basic web files"
echo "📁 Files created:"
echo "   - nginx/nginx.conf"
echo "   - docker/nginx.conf (copy)"
echo "   - web/index.html"
echo "   - logs/"
echo ""
echo "🔨 Now rebuild containers:"
echo "   docker-compose down"
echo "   docker-compose build --no-cache"
echo "   docker-compose up -d"
