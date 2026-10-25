# Use Python 3.11
FROM python:3.11-slim

# Install system dependencies for ChromaDB and PDF processing
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model to save time during container start
RUN python -c "from langchain_huggingface import HuggingFaceEmbeddings; HuggingFaceEmbeddings(model_name='all-MiniLM-L6-v2')"

COPY . .

EXPOSE 8000

CMD ["python", "api.py"]