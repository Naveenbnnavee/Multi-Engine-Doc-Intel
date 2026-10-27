try:
    __import__('pysqlite3')
    import sys
    sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
except (ImportError, KeyError):
    pass

import os
import tempfile
import logging
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# LangChain Imports
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

# Configure structured logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("doc-intel-api")

load_dotenv()

app = FastAPI(
    title="Multi-Engine Document Intelligence API",
    description="High-throughput RAG engine orchestrating FastEmbed vectorization and Gemini LLM synthesis.",
    version="2.4.0"
)

# --- CORS POLICY ---
# Dynamically loads allowed origins from environment variable ALLOWED_ORIGINS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [
    origin.strip()
    for origin in allowed_origins_env.split(",")
    if origin.strip()
]
default_origins = [
    "https://multi-engine-doc-intel.vercel.app",
    "https://multi-engine-doc-intel.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]
for origin in default_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)?(vercel\.app|onrender\.com)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Global in-memory vector database
vector_db = None

class ChatRequest(BaseModel):
    message: str

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global vector_db
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file format. Only PDF files are supported.")

    temp_path = None
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            content = await file.read()
            if len(content) == 0:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            temp_file.write(content)
            temp_path = temp_file.name

        # Extract text via PyPDF
        loader = PyPDFLoader(temp_path)
        pages = loader.load()

        if not pages:
            raise HTTPException(status_code=400, detail="Could not extract text from the provided PDF.")

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(pages)

        # Lightweight FastEmbed local vectorization (No Google API quota needed for embedding)
        embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        vector_db = Chroma.from_documents(documents=chunks, embedding=embeddings)

        logger.info(f"Processed PDF '{file.filename}' into {len(chunks)} chunks.")
        return {
            "status": "success",
            "message": "Document processed and vectorized successfully.",
            "chunks_count": len(chunks)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing uploaded PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Document processing failed. Please verify the PDF is not password-protected.")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass

# Global state for cached working model and discovered model candidates
CACHED_WORKING_MODEL: Optional[str] = None
DISCOVERED_MODELS_CACHE: Optional[list] = None

def is_valid_text_chat_model(name: str) -> bool:
    """Filter out speech/audio/vision-only and TTS models that cannot perform chat synthesis."""
    name_lower = name.lower()
    banned_substrings = [
        "tts", "audio", "voice", "speech", "image", "imagen", 
        "embed", "realtime", "live", "vision-preview"
    ]
    if any(b in name_lower for b in banned_substrings):
        return False
    return name_lower.startswith("gemini")

def discover_available_gemini_models() -> list:
    """
    Dynamically queries Google Generative AI to discover models available 
    for the active API key that support generateContent, prioritizing Flash models.
    """
    global DISCOVERED_MODELS_CACHE
    if DISCOVERED_MODELS_CACHE:
        return DISCOVERED_MODELS_CACHE

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    discovered = []

    # Priority 1: Explicit environment variable override
    custom_model = os.getenv("GEMINI_MODEL")
    if custom_model and custom_model.strip():
        discovered.append(custom_model.strip())

    if api_key:
        # Priority 2: Programmatic Discovery via official google.genai Client
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            for m in client.models.list():
                actions = getattr(m, "supported_actions", []) or getattr(m, "supported_generation_methods", [])
                if not actions or "generateContent" in actions:
                    name = getattr(m, "name", "")
                    if name.startswith("models/"):
                        name = name[len("models/"):]
                    if name and is_valid_text_chat_model(name) and name not in discovered:
                        discovered.append(name)
            if discovered:
                logger.info(f"Discovered {len(discovered)} active text models via google.genai Client.")
        except Exception as e:
            logger.warning(f"Programmatic models.list() discovery returned: {e}. Trying REST endpoint...")

        # Priority 3: Direct REST endpoint discovery
        if not discovered or len(discovered) <= 1:
            try:
                import httpx
                url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                with httpx.Client(timeout=4.0) as http_client:
                    resp = http_client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        for m in data.get("models", []):
                            methods = m.get("supportedGenerationMethods", [])
                            if not methods or "generateContent" in methods:
                                name = m.get("name", "")
                                if name.startswith("models/"):
                                    name = name[len("models/"):]
                                if name and is_valid_text_chat_model(name) and name not in discovered:
                                    discovered.append(name)
                        if discovered:
                            logger.info(f"Discovered {len(discovered)} active text models via REST endpoint.")
            except Exception as e:
                logger.warning(f"REST models discovery returned: {e}")

    # Priority 4: Verified production text model candidates
    known_candidates = [
        "gemini-flash-latest",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-1.5-pro",
        "gemini-2.0-pro"
    ]
    for candidate in known_candidates:
        if candidate not in discovered:
            discovered.append(candidate)

    # Filter strictly for valid conversational text models
    clean_discovered = [m for m in discovered if is_valid_text_chat_model(m)]

    # Sort so that Flash models come first (highest throughput, lowest latency, cost-effective for RAG)
    flash_models = [m for m in clean_discovered if "flash" in m.lower()]
    other_models = [m for m in clean_discovered if "flash" not in m.lower()]
    sorted_models = flash_models + other_models

    DISCOVERED_MODELS_CACHE = sorted_models
    logger.info(f"Final ordered candidate text models: {sorted_models[:6]}")
    return sorted_models

@app.post("/chat")
async def chat_with_pdf(request: ChatRequest):
    global vector_db, CACHED_WORKING_MODEL
    if vector_db is None:
        raise HTTPException(status_code=400, detail="No document uploaded yet. Please upload a PDF first.")

    user_query = request.message.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query message cannot be empty.")

    try:
        retriever = vector_db.as_retriever(search_kwargs={"k": 4})
        
        # Discover and sort available Gemini models dynamically
        candidates = discover_available_gemini_models()
        if CACHED_WORKING_MODEL and CACHED_WORKING_MODEL in candidates:
            candidates = [CACHED_WORKING_MODEL] + [m for m in candidates if m != CACHED_WORKING_MODEL]
        
        system_prompt = (
            "You are an intelligent assistant. Use the following pieces of retrieved context "
            "to answer the user's question accurately. If the answer is not in the context, say "
            "'I cannot find this information in the provided documents.'\n\n"
            "Context:\n{context}"
        )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])
        
        last_error = None
        for model_name in candidates:
            try:
                logger.info(f"Attempting synthesis with model: '{model_name}'")
                llm = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=0.2,
                    max_retries=1,
                    timeout=12.0
                )
                question_answer_chain = create_stuff_documents_chain(llm, prompt)
                rag_chain = create_retrieval_chain(retriever, question_answer_chain)
                response = rag_chain.invoke({"input": user_query})
                
                # Cache successful model for subsequent queries
                CACHED_WORKING_MODEL = model_name
                logger.info(f"Synthesis succeeded with model: '{model_name}'")
                return {"answer": response["answer"], "model_used": model_name}
            except Exception as model_err:
                logger.warning(f"Candidate model '{model_name}' failed: {model_err}. Fast failover to next model...")
                last_error = model_err

        logger.error(f"All candidate models failed in RAG chain: {last_error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to synthesize response. Ensure valid GEMINI_API_KEY is configured.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unhandled error in chat pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to synthesize response. Ensure valid GEMINI_API_KEY is configured.")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "multi-engine-doc-intel",
        "vector_db_loaded": vector_db is not None
    }

# --- STATIC ASSET & SPA SERVING ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
FRONTEND_ASSETS = os.path.join(FRONTEND_DIST, "assets")
FRONTEND_INDEX = os.path.join(FRONTEND_DIST, "index.html")

# Only mount static directory if it physically exists to prevent Startup RuntimeError
if os.path.isdir(FRONTEND_ASSETS):
    logger.info(f"Mounting static assets from: {FRONTEND_ASSETS}")
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="assets")
else:
    logger.warning(f"Static assets directory not found at: {FRONTEND_ASSETS}. Running in API-only mode.")

@app.get("/")
def read_root():
    if os.path.isfile(FRONTEND_INDEX):
        return FileResponse(FRONTEND_INDEX)
    return {
        "status": "healthy",
        "service": "Multi-Engine Document Intelligence API",
        "message": "API is online and accepting connections.",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "upload": "/upload (POST)",
            "chat": "/chat (POST)"
        }
    }

@app.get("/{catchall:path}")
def serve_react_app(catchall: str):
    # Do not intercept API docs or reserved paths
    if catchall.startswith(("upload", "chat", "health", "docs", "openapi.json", "api")):
        raise HTTPException(status_code=404, detail="Resource not found")
    if os.path.isfile(FRONTEND_INDEX):
        return FileResponse(FRONTEND_INDEX)
    return {
        "status": "healthy",
        "service": "Multi-Engine Document Intelligence API",
        "message": "Frontend build not present. Use API endpoints or Swagger UI at /docs."
    }