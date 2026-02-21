#!/bin/bash

echo "🧹 Cleaning up existing ShopHub processes..."

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

echo "✅ Cleanup complete. Waiting 2 seconds..."
sleep 2

# Verify ports are free
echo ""
echo "📊 Port Status:"
echo "  Port 8000 (backend):" $(lsof -i :8000 2>/dev/null | grep LISTEN || echo "✓ Free")
echo "  Port 3000 (frontend):" $(lsof -i :3000 2>/dev/null | grep LISTEN || echo "✓ Free")

echo ""
echo "🚀 Starting ShopHub services..."
echo ""

# Start backend
echo "Starting backend on port 8000..."
cd backend && source venv/bin/activate && python run.py > backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start frontend
echo ""
echo "Starting frontend on port 3000..."
cd ..
npm run dev -- --hostname 0.0.0.0 --port 3000 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 3

echo ""
echo "✅ Services started!"
echo ""
echo "📝 Access URLs:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo ""
echo "📋 Process IDs (for stopping later):"
echo "  Backend:  $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo "🛑 To stop services:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "📊 To view logs:"
echo "  tail -f frontend.log"
echo "  tail -f backend/backend.log"
