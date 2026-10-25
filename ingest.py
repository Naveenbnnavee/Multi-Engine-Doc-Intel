import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma

# 1. Load API Key
load_dotenv()
if not os.getenv("GEMINI_API_KEY"):
    raise ValueError("GEMINI_API_KEY is missing from .env")

# 2. Define file paths
PDF_PATH = "data/NaveenResume.pdf"
DB_DIR = "chroma_db" # This is where the vector database will be saved

def build_vector_db():
    print(f"📄 Loading {PDF_PATH}...")
    loader = PyPDFLoader(PDF_PATH)
    pages = loader.load()
    print(f"✅ Loaded {len(pages)} pages.")

    # 3. Chop the text into smaller, overlapping chunks
    print("✂️ Splitting text into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=200 # Overlap prevents cutting a sentence in half
    )
    chunks = text_splitter.split_documents(pages)
    print(f"✅ Split into {len(chunks)} chunks.")

    # 4. Convert chunks to vectors and save to ChromaDB
    print("🧠 Creating embeddings and saving to database (this takes a moment)...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    
    # Create the database and save it to the DB_DIR
    vector_db = Chroma.from_documents(
        documents=chunks, 
        embedding=embeddings, 
        persist_directory=DB_DIR
    )
    vector_db.persist()
    print(f"🎉 Success! Database saved to '{DB_DIR}' folder.")

if __name__ == "__main__":
    build_vector_db()