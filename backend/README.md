# Per-Flex-ity Backend

A lightweight open source AI-powered search and chat backend with Claim-Verified Answering (CVA) and conversation management.

## Features

- **FastAPI Backend** with SQLite database
- **Ollama LLM Integration** for local inference
- **Real Web Search** with document fetching and parsing (all asynchronous)
- **Vector Retrieval** with in-memory caching for speed
- **Claim-Verified Answering (CVA)** for fact-checking claims
- **Streaming Responses** via Server-Sent Events

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment (optional)
cp .env.example .env
# Edit .env to add your SerpAPI key for premium search

# Start Ollama (required)
ollama serve
ollama pull qwen2.5:3b-instruct-q4_0

# Start server
python main.py
```

Server runs at `http://localhost:8000`

## Configuration

The system uses a `.env` file for configuration:

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
vim .env
```

### Search Configuration

- **DDGS (Free)**: Works out of the box, no API key needed
- **SerpAPI (Optional)**: Add your API key to `.env` for premium fallback
  - Get free API key at: https://serpapi.com/users/sign_up
  - 100 free searches/month, then ~$5/1000 searches

```env
# Optional: SerpAPI for premium search fallback
SERPAPI_KEY=your_api_key_here
```

## API Usage

### Chat Endpoint
```bash
curl -X POST "http://localhost:8000/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is machine learning?", "enable_cva": false, "conversation_id": null}'
```
follow-up messages can include `conversation_id` from previous responses to maintain context.

### With CVA (Claim Verification)
```bash
curl -X POST "http://localhost:8000/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"message": "Python is faster than Java", "enable_cva": true}'
```

### Conversations endpoint

## with page and limit
```bash
curl -X GET "http://localhost:8000/api/conversations?page=1&limit=10" \
  -H "Content-Type: application/json"
```

#### fetch an existing conversation via id

```bash
curl -X GET "http://localhost:8000/api/conversations/{id}" \
  -H "Content-Type: application/json"
```

## Testing

```bash
pytest tests/ -v
```

## Requirements

- Python 3.11+
- Ollama running locally
- Internet connection for web search

## Architecture

- **Core**: Configuration, database, dependencies, exceptions
- **Models**: API and domain models  
- **Routes**: Chat and conversation endpoints
- **Services**: LLM, search, retrieval, CVA, orchestrator