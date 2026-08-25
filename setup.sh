#!/bin/bash

# MT5 Trading Charts - Quick Start

echo "🚀 MT5 Trading Charts - Setup"
echo "============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+"
    exit 1
fi

echo "✅ Node.js $(node -v) found"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
    echo ""
    echo "🎯 To start development:"
    echo "   npm run dev"
    echo ""
    echo "📊 Frontend: http://localhost:5173"
    echo "🔌 Backend:  http://localhost:3001"
    echo "🔗 WebSocket: ws://localhost:3001/ws"
    echo ""
    echo "For more information, see README.md"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
