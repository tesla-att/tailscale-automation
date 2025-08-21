#!/bin/bash

# Restart Backend Services Script
# Fixes API connection issues after backend code changes

echo "🔄 Restarting ATT Tailscale Backend Services"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to check if docker-compose exists
check_compose() {
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${RED}❌ docker-compose not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker Compose available${NC}"
}

# Main execution
echo -e "${BLUE}📋 Checking prerequisites...${NC}"
check_docker
check_compose

echo -e "\n${BLUE}🛑 Stopping existing services...${NC}"
docker compose down

echo -e "\n${BLUE}🧹 Cleaning up containers and volumes...${NC}"
docker system prune -f
docker volume prune -f

echo -e "\n${BLUE}🏗️  Rebuilding backend services...${NC}"
docker compose build --no-cache api

echo -e "\n${BLUE}🚀 Starting services...${NC}"
docker compose up -d

echo -e "\n${BLUE}⏳ Waiting for services to start...${NC}"
sleep 10

# Check service status
echo -e "\n${BLUE}📊 Service Status:${NC}"
docker compose ps

# Test API endpoints
echo -e "\n${BLUE}🧪 Testing API endpoints...${NC}"

# Check health endpoint
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/healthz 2>/dev/null || echo "000")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Health endpoint responding (HTTP $HEALTH_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Health endpoint not responding (HTTP $HEALTH_RESPONSE)${NC}"
fi

# Check users endpoint
USERS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/users 2>/dev/null || echo "000")
if [ "$USERS_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Users API responding (HTTP $USERS_RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠️  Users API response: HTTP $USERS_RESPONSE${NC}"
fi

# Check devices endpoint
DEVICES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/devices 2>/dev/null || echo "000")
if [ "$DEVICES_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Devices API responding (HTTP $DEVICES_RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠️  Devices API response: HTTP $DEVICES_RESPONSE${NC}"
fi

# Summary
echo -e "\n${BLUE}📊 Summary:${NC}"
echo "=================="
echo -e "Backend API: ${HEALTH_RESPONSE = "200" && echo -e "${GREEN}✅ Running${NC}" || echo -e "${RED}❌ Failed${NC}"}"
echo -e "Users API: ${USERS_RESPONSE = "200" && echo -e "${GREEN}✅ OK${NC}" || echo -e "${YELLOW}⚠️  Check logs${NC}"}"
echo -e "Devices API: ${DEVICES_RESPONSE = "200" && echo -e "${GREEN}✅ OK${NC}" || echo -e "${YELLOW}⚠️  Check logs${NC}"}"

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "\n${GREEN}🎉 Backend services restarted successfully!${NC}"
    echo -e "${BLUE}📝 Next steps:${NC}"
    echo "1. Test your frontend: http://localhost:3000"
    echo "2. Check API docs: http://localhost:8000/docs"
    echo "3. View logs: docker compose logs -f api"
else
    echo -e "\n${RED}❌ Backend restart failed!${NC}"
    echo -e "${YELLOW}🔍 Check logs with: docker compose logs api${NC}"
    exit 1
fi

echo -e "\n${YELLOW}💡 Tip: Use 'docker compose logs -f api' to monitor backend logs${NC}"
