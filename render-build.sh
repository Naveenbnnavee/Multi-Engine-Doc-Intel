#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "===> Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# If node/npm is available, compile frontend
if command -v npm >/dev/null 2>&1; then
    echo "===> Node/npm detected. Building React frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
else
    echo "===> Node/npm not available. Serving pre-bundled frontend assets in frontend/dist."
fi

echo "===> Build completed successfully."
