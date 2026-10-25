import os
import tempfile
import streamlit as st
from dotenv import load_dotenv

# LangChain & Google AI Imports
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

# 1. Setup & API Authentication
load_dotenv()
if not os.getenv("GEMINI_API_KEY"):
    st.error("Missing GEMINI_API_KEY. Please check your environment variables.")
    st.stop()

st.set_page_config(page_title="PDF Chatter", page_icon="📄", layout="wide")

# 2. Sidebar for Multi-File Upload
with st.sidebar:
    st.header("📂 Upload Documents")
    uploaded_files = st.file_uploader(
        "Select one or more PDFs", 
        type="pdf", 
        accept_multiple_files=True
    )
    process_btn = st.button("Process PDFs", type="primary")
    
    st.divider()
    st.caption("Using Gemini 2.5 Flash & Cloud Embeddings")

# 3. Data Processing Function
def process_documents(files):
    all_pages = []
    
    for uploaded_file in files:
        # Use a temporary file to allow LangChain to read the PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(uploaded_file.read())
            temp_path = temp_file.name
            
        loader = PyPDFLoader(temp_path)
        all_pages.extend(loader.load())
        
        # Immediate cleanup of temporary file
        os.remove(temp_path)
        
    # Split text into manageable chunks
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_documents(all_pages)
    
    # Using Cloud Embeddings to stay within Render's 512MB RAM limit
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    
    # Build the Vector Database in RAM
    vector_db = Chroma.from_documents(documents=chunks, embedding=embeddings)
    
    return vector_db

# 4. Trigger Ingestion
if process_btn and uploaded_files:
    with st.spinner("Processing documents..."):
        # Store the vector database in the user's session state
        st.session_state["vector_db"] = process_documents(uploaded_files)
        st.success("✅ Ready! Ask your questions below.")

# 5. Main UI & Chat Interface
st.title("📄 Chat with Multiple PDFs")

if "vector_db" in st.session_state:
    db = st.session_state["vector_db"]
    retriever = db.as_retriever(search_kwargs={"k": 5}) 
    
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
    
    # Create the RAG Chain
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, question_answer_chain)

    user_input = st.text_input("Ask a question:")

    if user_input:
        with st.spinner("Analyzing..."):
            try:
                response = rag_chain.invoke({"input": user_input})
                
                st.markdown("### Answer")
                st.write(response["answer"])
                
                # Expandable source tracking
                with st.expander("Show Sources"):
                    for i, doc in enumerate(response["context"]):
                        source_name = doc.metadata.get('source', 'Unknown')
                        st.write(f"**Chunk {i+1}** (Source: {source_name})")
                        st.info(doc.page_content)
                        st.divider()
                        
            except Exception as e:
                st.error(f"Error: {e}")
else:
    st.info("👈 Please upload PDFs and click 'Process' to begin.")