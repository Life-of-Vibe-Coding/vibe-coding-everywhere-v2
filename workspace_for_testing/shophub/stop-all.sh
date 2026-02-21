#!/bin/bash

echo "🛑 Stopping all ShopHub services..."

# Kill all Next.js processes in this directory
pkill -f "next dev.*shophub" 2>/dev/null
pkill -f "next-server.*shophub" 2>/dev/null

# Kill Python backend processes on port 8000-8010
for port in {8000..8010}; do
  lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null
done

# Kill Next.js frontend on ports 3000-3500
for port in {3000..3010}; do
  lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null
done

echo "✅ All services stopped."
