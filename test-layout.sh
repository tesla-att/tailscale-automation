#!/bin/bash

# Layout Test Script for Tailscale Manager
echo "🔍 Layout Test Script - Tailscale Manager"
echo "==========================================="

# Function to test a URL
test_layout() {
    local port=$1
    local url="http://localhost:$port"
    echo ""
    echo "📊 Testing Port $port - $url"
    echo "----------------------------------------"
    
    # Test basic connectivity
    if curl -s -w "%{http_code}" "$url" | grep -q "200"; then
        echo "✅ Port $port: HTTP Connection OK"
    else
        echo "❌ Port $port: HTTP Connection Failed"
        return 1
    fi
    
    # Test HTML content
    local html_content=$(curl -s "$url")
    
    # Check for basic HTML structure
    if echo "$html_content" | grep -q "<html"; then
        echo "✅ Port $port: HTML Structure OK"
    else
        echo "❌ Port $port: Invalid HTML Structure"
    fi
    
    # Check for CSS loading
    if echo "$html_content" | grep -q -E "(tailwind|index\.css|\.css)"; then
        echo "✅ Port $port: CSS References Found"
    else
        echo "❌ Port $port: No CSS References"
    fi
    
    # Check for React app mounting
    if echo "$html_content" | grep -q -E "(react|vite|root)"; then
        echo "✅ Port $port: React App Structure Found"
    else
        echo "❌ Port $port: No React App Structure"
    fi
    
    # Check text direction in HTML
    if echo "$html_content" | grep -q 'dir="rtl"'; then
        echo "⚠️  Port $port: RTL Direction Detected"
    elif echo "$html_content" | grep -q 'dir="ltr"'; then
        echo "✅ Port $port: LTR Direction OK"
    else
        echo "ℹ️  Port $port: No explicit direction set"
    fi
    
    # Save content to file for manual inspection
    echo "$html_content" > "/tmp/layout-test-port-$port.html"
    echo "📄 Port $port: Content saved to /tmp/layout-test-port-$port.html"
}

# Function to compare two HTML outputs
compare_layouts() {
    echo ""
    echo "🔄 Comparing Layouts Between Ports"
    echo "===================================="
    
    if [ -f "/tmp/layout-test-port-3000.html" ] && [ -f "/tmp/layout-test-port-5173.html" ]; then
        local diff_count=$(diff "/tmp/layout-test-port-3000.html" "/tmp/layout-test-port-5173.html" | wc -l)
        
        if [ "$diff_count" -eq 0 ]; then
            echo "✅ Layouts are identical"
        else
            echo "⚠️  Found $diff_count differences between layouts"
            echo "📄 Showing first 10 differences:"
            diff "/tmp/layout-test-port-3000.html" "/tmp/layout-test-port-5173.html" | head -20
        fi
    else
        echo "❌ Cannot compare - missing test files"
    fi
}

# Function to check services
check_services() {
    echo ""
    echo "🛠️  Checking Services"
    echo "====================="
    
    # Check Docker containers
    if command -v docker >/dev/null 2>&1; then
        echo "🐳 Docker Containers:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(api|web|db)" || echo "No relevant containers found"
    fi
    
    # Check running processes
    echo ""
    echo "⚙️  Relevant Processes:"
    ps aux | grep -E "(vite|node|docker)" | grep -v grep | head -5 || echo "No relevant processes found"
    
    # Check open ports
    echo ""
    echo "🌐 Open Ports:"
    netstat -tlnp 2>/dev/null | grep -E ":(3000|5173|8000)" | head -5 || echo "No relevant ports found"
}

# Main execution
echo "$(date): Starting layout test..."

# Check services first
check_services

# Test layout test HTML file
echo ""
echo "🧪 Testing Layout Test HTML File"
echo "================================="
if [ -f "/opt/tailscale-manager/layout-test.html" ]; then
    echo "✅ Layout test file exists"
    
    # Test via Python HTTP server if available
    if command -v python3 >/dev/null 2>&1; then
        echo "🐍 Starting Python HTTP server for layout test..."
        cd /opt/tailscale-manager
        python3 -m http.server 8080 &
        HTTP_PID=$!
        sleep 2
        
        echo "📊 Testing layout test file via HTTP server..."
        if curl -s "http://localhost:8080/layout-test.html" | grep -q "Layout Test"; then
            echo "✅ Layout test file loads correctly"
        else
            echo "❌ Layout test file failed to load"
        fi
        
        kill $HTTP_PID 2>/dev/null || true
    fi
else
    echo "❌ Layout test file not found"
fi

# Test both ports
test_layout 3000
test_layout 5173

# Compare results
compare_layouts

# Final summary
echo ""
echo "📋 SUMMARY"
echo "=========="
echo "✅ Check /tmp/layout-test-port-*.html files for detailed comparison"
echo "✅ Access http://localhost:3000 and http://localhost:5173 manually"
echo "✅ Use browser dev tools to inspect CSS and layout differences"
echo ""
echo "🔧 Troubleshooting Tips:"
echo "   - Check browser console for CSS/JS errors"
echo "   - Inspect HTML elements for alignment issues"
echo "   - Verify Tailwind CSS is loading correctly"
echo "   - Compare computed styles between ports"
