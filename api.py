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

@app.post("/chat")
async def chat_with_pdf(request: ChatRequest):
    global vector_db
    if vector_db is None:
        raise HTTPException(status_code=400, detail="No document uploaded yet. Please upload a PDF first.")

    user_query = request.message.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query message cannot be empty.")

    try:
        retriever = vector_db.as_retriever(search_kwargs={"k": 5})
        
        # Gemini synthesis
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3)
        
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
        
        question_answer_chain = create_stuff_documents_chain(llm, prompt)
        rag_chain = create_retrieval_chain(retriever, question_answer_chain)

        response = rag_chain.invoke({"input": user_query})
        return {"answer": response["answer"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying RAG pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to synthesize response. Ensure GEMINI_API_KEY is configured.")

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