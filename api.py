__import__('pysqlite3')
import sys
sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# LangChain Imports

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

app = FastAPI()

# --- CORS POLICY ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://pdf-chatter-1.onrender.com" 
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to hold the vector database in memory
vector_db = None

class ChatRequest(BaseModel):
    message: str

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global vector_db
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(await file.read())
            temp_path = temp_file.name

        # Extract text
        loader = PyPDFLoader(temp_path)
        pages = loader.load()
        os.remove(temp_path)

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(pages)

        # LIGHTWEIGHT FASTEMBED (No Google API needed for this step!)
        embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        
        vector_db = Chroma.from_documents(documents=chunks, embedding=embeddings)

        return {"message": "Document processed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_with_pdf(request: ChatRequest):
    global vector_db
    if vector_db is None:
        raise HTTPException(status_code=400, detail="No document uploaded yet.")

    try:
        retriever = vector_db.as_retriever(search_kwargs={"k": 5})
        
        # GEMINI IS STILL USED FOR THE CHAT RESPONSES
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3)
        
        system_prompt = (
            "You are an intelligent assistant. Use the following pieces of retrieved context "
            "to answer the user's question. If the answer is not in the context, say "
            "'I cannot find this information in the provided documents.'\n\n"
            "Context:\n{context}"
        )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])
        
        question_answer_chain = create_stuff_documents_chain(llm, prompt)
        rag_chain = create_retrieval_chain(retriever, question_answer_chain)

        response = rag_chain.invoke({"input": request.message})
        
        return {"answer": response["answer"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "PDF Chatter API is running securely!"}
app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
@app.get("/{catchall:path}")
def serve_react_app(catchall: str):
    # This assumes your api.py is in the root folder and your frontend is in a folder named 'frontend'
    return FileResponse("frontend/dist/index.html")