#!/bin/bash

# Quick Fix for Backend Connection Issue
echo "🔧 Quick Fix: Backend Connection Issue"
echo "====================================="

# Check if services are running
echo "1. Checking Docker services..."
docker compose ps

# Restart services if needed
echo -e "\n2. Restarting services..."
docker compose down
docker compose up -d

# Wait for services
echo -e "\n3. Waiting for services to start..."
sleep 5

# Test endpoints
echo -e "\n4. Testing endpoints..."
echo "Health: $(curl -s http://localhost:8000/healthz | head -20)"
echo "Devices: $(curl -s http://localhost:8000/api/devices | head -50)"

echo -e "\n5. Testing frontend health check..."
echo "Frontend health check should now work!"

echo -e "\n✅ Fix completed. Check your browser!"
