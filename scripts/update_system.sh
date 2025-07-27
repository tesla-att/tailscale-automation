#!/bin/bash
echo "🔧 Updating Tailscale Automation System..."

# Step 1: Stop containers
echo "📦 Stopping containers..."
docker-compose down

# Step 2: Fix Redis memory
echo "🔧 Fixing Redis memory..."
if ! grep -q "vm.overcommit_memory = 1" /etc/sysctl.conf 2>/dev/null; then
    echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
    sudo sysctl vm.overcommit_memory=1
fi

# Step 3: Rebuild containers
echo "🔨 Rebuilding containers..."
docker-compose build --no-cache

# Step 4: Start containers
echo "▶️  Starting containers..."
docker-compose up -d

# Step 5: Wait and check
echo "⏳ Waiting for services..."
sleep 20

echo "✅ Update completed!"
echo "🌐 Access: http://localhost:8080"
echo "🔍 Check status: docker-compose ps"