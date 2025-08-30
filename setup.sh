#!/bin/bash

# Per-Flex-ity Quick Setup Script
# Automated setup for LangChain-powered AI search system

set -e  # Exit on any error

echo "🚀 Per-Flex-ity Quick Setup Starting..."
echo "=========================================="

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    echo "✅ Ollama installed"
else
    echo "✅ Ollama already installed"
fi

# Start Ollama service
echo "🔄 Starting Ollama service..."
ollama serve &
sleep 3  # Wait for service to start

# Pull required models
echo "📥 Downloading AI models (this may take a few minutes)..."
echo "   - Main chat model (qwen2.5:3b-instruct-q4_0) ~1.7GB"
ollama pull qwen2.5:3b-instruct-q4_0

echo "   - CVA model (qwen2.5:1.5b-instruct) ~1.0GB"  
ollama pull qwen2.5:1.5b-instruct

echo "   - Embedding model (nomic-embed-text) ~274MB"
ollama pull nomic-embed-text

echo "✅ All models downloaded"

# Setup backend
echo "🐍 Setting up backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

echo "✅ Backend setup complete"

# Setup frontend
echo "🌐 Setting up frontend..."
cd ../frontend

# Check if Node.js is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo "✅ Frontend setup complete"

# Create .env file if it doesn't exist
cd ..
if [ ! -f ".env" ]; then
    echo "📝 Creating default .env file..."
    cat > .env << EOF
# Per-Flex-ity Configuration
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2.5:3b-instruct-q4_0
CVA_CLAIM_MODEL=qwen2.5:1.5b-instruct
EMBEDDING_MODEL=nomic-embed-text
EOF
    echo "✅ .env file created"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "🚀 To start the system:"
echo "   Terminal 1: cd backend && source venv/bin/activate && python main.py"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "🌐 Access URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   Health Check: http://localhost:8000/health"
echo ""
echo "🧪 Test API:"
echo '   curl -X POST "http://localhost:8000/api/ask" \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '"'"'{"message": "What is GGML?", "enable_cva": true, "stream": false}'"'"
echo ""
echo "✨ Features enabled:"
echo "   • LangChain query decomposition"  
echo "   • Real-time streaming responses"
echo "   • Intelligent claim verification"
echo "   • Conversation context flow"
echo "   • Source deduplication"