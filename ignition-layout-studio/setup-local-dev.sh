#!/bin/bash

# Local setup script for Ignition Layout Studio
set -e

# Go to script directory
cd "$(dirname "$0")"

# Install backend dependencies
cd backend
if [ ! -d "node_modules" ]; then
  echo "Installing backend dependencies..."
  npm install
else
  echo "Backend dependencies already installed."
fi

# Check for .env file
if [ ! -f ".env" ]; then
  echo "No .env file found in backend. Creating a template .env..."
  cat <<EOL > .env
PORT=5000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
MAX_FILE_SIZE=100MB
PADDLE_OCR_MODEL_PATH=./models/paddleocr
EOL
  echo ".env file created. Please review and edit as needed."
else
  echo ".env file already exists."
fi

# Start backend (in background)
echo "Starting backend server..."
npm run dev &
BACKEND_PID=$!

# Install frontend dependencies
cd ../frontend
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
else
  echo "Frontend dependencies already installed."
fi

# Start frontend (in foreground)
echo "Starting frontend server..."
npm start

# Cleanup: kill backend on exit
trap "kill $BACKEND_PID" EXIT 