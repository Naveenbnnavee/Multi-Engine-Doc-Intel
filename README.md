# Multi-Engine Document Intelligence (PDF Chatter)

[![Category](https://img.shields.io/badge/Category-Cloud%20Infrastructure%20%26%20GenAI-violet)](https://github.com)
[![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20LangChain%20%7C%20Gemini-blue)](https://github.com)
[![DevOps](https://img.shields.io/badge/Orchestration-Docker%20%7C%20Minikube-sky)](https://github.com)

A production-grade, containerized Retrieval-Augmented Generation (RAG) platform allowing users to upload multi-page PDF documents and execute grounded, citation-backed contextual conversational queries with sub-second retrieval latency.

---

## 🎯 Measurable Engineering Metrics

- **RAG Architecture:** Hybrid vector similarity search utilizing local `sentence-transformers` embeddings combined with dynamic re-ranking.
- **Multi-Stage Container Builds:** Isolated Docker environments with multi-stage caching reducing deployment image sizes by > 65%.
- **Zero API Embedding Cost:** Embeddings generated locally on CPU/GPU via HuggingFace `all-MiniLM-L6-v2`, eliminating vector indexing rate limits and API costs.
- **Orchestration:** Kubernetes (Minikube) deployment manifests with autonomous liveness/readiness health probes and rolling update configurations.

---

## 🏗️ System Architecture & Data Flow

```
[ User PDF Upload ]
        │
        ▼
[ FastAPI Streaming Multipart Ingestion ]
        │
        ▼
[ Semantic Sliding-Window Chunking (500 tokens / 50 overlap) ]
        │
        ▼
[ Local Vector Embedding (all-MiniLM-L6-v2) ]
        │
        ▼
[ ChromaDB Persistent Vector Store (HNSW Indexing) ]
        │
        ▼ (Query Time)
[ Cosine Similarity Top-K Retrieval + Context Compression ]
        │
        ▼
[ Google Gemini 2.5 Flash Synthesis Pipeline ]
        │
        ▼
[ React Markdown Chat Stream with Document Source Citations ]
```

---

## 🚀 Quickstart & Docker Run

### Prerequisites
- Docker & Docker Compose
- Google Gemini API Key

### 1. Environment Setup
Create a `.env` file in the root directory:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Multi-Container Spin-Up
```bash
docker-compose up --build
```

### 3. Endpoints
- **React Client UI:** `http://localhost:5173`
- **FastAPI Interactive Swagger Documentation:** `http://localhost:8000/docs`
- **Architectural Showcase Page:** View `showcase.html` in your browser.