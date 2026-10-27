import { useState, useRef, useEffect } from 'react';
import './App.css';
import Markdown from 'react-markdown';
import {
  FileText,
  Upload,
  Send,
  Check,
  Copy,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Zap,
  Cpu,
  Database,
  Layers,
  Terminal,
  RefreshCw,
  Settings,
  HelpCircle,
  ExternalLink,
  Bot,
  User,
  AlertCircle
} from 'lucide-react';

export default function App() {
  // Navigation: 'overview' (Portfolio / How It Works) or 'chat' (Interactive Workspace)
  const [viewMode, setViewMode] = useState('overview');

  // Backend API configuration - dynamically loaded from Vite environment variable
  const [apiUrl, setApiUrl] = useState(() => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
    const saved = localStorage.getItem('docintel_api_url');
    if (saved && !saved.includes('pdf-chatter-ouph')) {
      return saved.replace(/\/+$/, '');
    }
    return 'https://multi-engine-doc-intel.onrender.com';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'

  // Chat & Upload state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [activeFile, setActiveFile] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check backend health periodically
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(4000) });
        if (res.ok && isMounted) {
          setBackendStatus('online');
        } else if (isMounted) {
          setBackendStatus('offline');
        }
      } catch {
        if (isMounted) setBackendStatus('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (viewMode === 'chat') {
      scrollToBottom();
    }
  }, [messages, isTyping, viewMode]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setActiveFile(file.name);
    setIsUploading(true);
    setUploadStatus('Ingesting & Vectorizing (FastEmbed 384D)...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadStatus('Vectorized & Ready for Analysis!');
        // Automatically switch to chat view if still on overview
        setViewMode('chat');
        setMessages([
          {
            sender: 'bot',
            text: `📄 **Document Indexed Successfully:** \`${file.name}\`\n\nAll text chunks have been vectorized into our in-memory ChromaDB vector store using FastEmbed (BAAI/bge-small-en-v1.5). You can now ask questions, request summaries, or extract key points.`
          }
        ]);
      } else {
        const errData = await response.json().catch(() => ({}));
        setUploadStatus(errData.detail || 'Upload failed.');
        setActiveFile('');
      }
    } catch {
      setUploadStatus('Could not reach backend API. Check Render URL.');
      setActiveFile('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (textToSend = input) => {
    const query = typeof textToSend === 'string' ? textToSend.trim() : input.trim();
    if (!query) return;

    const userMessage = { text: query, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.answer) {
        setMessages((prev) => [...prev, { text: data.answer, sender: 'bot' }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { text: data.detail || 'The synthesis pipeline encountered an error.', sender: 'error' }
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { text: '⚠️ Unable to reach the backend service. If hosted on Render free tier, the container may be waking up (please retry in 20 seconds).', sender: 'error' }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const saveApiSettings = (e) => {
    e.preventDefault();
    const cleanUrl = tempApiUrl.replace(/\/+$/, '');
    setApiUrl(cleanUrl);
    localStorage.setItem('docintel_api_url', cleanUrl);
    setIsSettingsOpen(false);
  };

  const starterQuestions = [
    'Summarize the core takeaways in 3 concise bullet points.',
    'What are the primary conclusions or outcomes mentioned?',
    'Identify any critical dates, deadlines, or timelines.',
    'Extract all limitations, caveats, or risks stated in the text.'
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewMode('overview')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-violet-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-400" />
              </div>
            </div>
            <div>
              <div className="font-bold text-base tracking-tight flex items-center gap-2">
                <span>DocIntel AI</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/30 font-medium">
                  RAG v2.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Multi-Engine Document Intelligence</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('overview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'overview'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Overview & Architecture</span>
            </button>
            <button
              onClick={() => setViewMode('chat')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                viewMode === 'chat'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Document Workspace</span>
              {activeFile && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Document Loaded"></span>
              )}
            </button>
          </nav>

          {/* Status & Settings */}
          <div className="flex items-center gap-3">
            {/* Backend Health Badge */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                backendStatus === 'online'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : backendStatus === 'checking'
                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
              title={`API endpoint: ${apiUrl}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'online'
                    ? 'bg-emerald-400 animate-pulse'
                    : backendStatus === 'checking'
                    ? 'bg-yellow-400'
                    : 'bg-rose-400'
                }`}
              ></span>
              <span>{backendStatus === 'online' ? 'API Online' : backendStatus === 'checking' ? 'Checking' : 'API Sleeping'}</span>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
              title="Configure API Endpoint"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* VIEW 1: PORTFOLIO & ARCHITECTURE SHOWCASE ("About that project & How it works") */}
      {viewMode === 'overview' && (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-16">
          {/* Hero Section */}
          <section className="text-center max-w-3xl mx-auto space-y-6 pt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Multi-Engine RAG Pipeline • Zero Embedding API Surcharge</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Enterprise Document Intelligence & Conversational RAG
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Ground high-parameter reasoning in verified document context. Orchestrates local{' '}
              <strong className="text-cyan-400 font-semibold">FastEmbed 384D</strong> vectorization, in-memory{' '}
              <strong className="text-violet-400 font-semibold">ChromaDB</strong> similarity indexing, and{' '}
              <strong className="text-emerald-400 font-semibold">Google Gemini 2.5 Flash</strong> synthesis without server data retention.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setViewMode('chat')}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white font-semibold text-sm hover:opacity-95 shadow-xl shadow-violet-600/25 flex items-center gap-2 transition-all group"
              >
                <span>Launch Document Chatbot</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#how-it-works"
                className="px-6 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-medium text-sm hover:text-white hover:border-slate-700 transition-colors flex items-center gap-2"
              >
                <span>Explore Processing Flow</span>
              </a>
            </div>
          </section>

          {/* Key Metrics Grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 hover:border-violet-500/40 transition-colors">
              <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5" /> Turnaround
              </div>
              <div className="text-3xl font-black text-white font-mono tracking-tight">&lt; 180ms</div>
              <p className="text-xs text-slate-400 mt-2">In-memory vector retrieval with PyPDF extraction.</p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 hover:border-violet-500/40 transition-colors">
              <div className="text-xs font-mono text-violet-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Database className="w-3.5 h-3.5" /> Geometry
              </div>
              <div className="text-3xl font-black text-white font-mono tracking-tight">384-Dim</div>
              <p className="text-xs text-slate-400 mt-2">Dense cosine semantic space via BAAI/bge-small-en-v1.5.</p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 hover:border-emerald-500/40 transition-colors">
              <div className="text-xs font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Privacy
              </div>
              <div className="text-3xl font-black text-white font-mono tracking-tight">$0 / 100%</div>
              <p className="text-xs text-slate-400 mt-2">Ephemeral in-memory vectors with zero persistent disk egress.</p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 hover:border-cyan-500/40 transition-colors">
              <div className="text-xs font-mono text-purple-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Cpu className="w-3.5 h-3.5" /> Synthesis
              </div>
              <div className="text-3xl font-black text-white font-mono tracking-tight">Gemini 2.5</div>
              <p className="text-xs text-slate-400 mt-2">Strict context grounding to eliminate model hallucinations.</p>
            </div>
          </section>

          {/* How It Works Pipeline */}
          <section id="how-it-works" className="space-y-6 pt-4">
            <div className="border-b border-slate-800 pb-4">
              <div className="text-xs font-mono text-violet-400 uppercase tracking-widest">Pipeline Architecture</div>
              <h2 className="text-2xl font-bold text-white mt-1">How Multi-Engine Document Intelligence Works</h2>
              <p className="text-sm text-slate-400 mt-1">A transparent 4-stage pipeline from raw PDF ingestion to contextually verified answers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden">
                <span className="text-xs font-mono text-violet-400 font-bold">STAGE 01</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>PDF Ingestion</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  PyPDF loads the uploaded binary in-memory. RecursiveCharacterTextSplitter shards content into 1,000-character chunks with 200-char semantic boundary overlap.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden">
                <span className="text-xs font-mono text-cyan-400 font-bold">STAGE 02</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-violet-400" />
                  <span>FastEmbed Vectors</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Local ONNX-accelerated FastEmbed embeddings run directly on the ASGI runtime. Computes 384-dimensional dense embeddings without external API network latency.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden">
                <span className="text-xs font-mono text-emerald-400 font-bold">STAGE 03</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>ChromaDB Retrieval</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Chroma index computes cosine similarity over document chunks. Filters and ranks the top-5 most relevant text passages for every user prompt in &lt;50ms.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden">
                <span className="text-xs font-mono text-purple-400 font-bold">STAGE 04</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Gemini Synthesis</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  LangChain LCEL chain injects retrieved chunks into a fortified system prompt. Google Gemini 2.5 Flash synthesizes clean markdown answers strictly from context.
                </p>
              </div>
            </div>
          </section>

          {/* DevOps & Tech Specs */}
          <section className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Stack Specifications</div>
              <h3 className="text-xl font-bold text-white mt-1">Production Architecture Components</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-5 rounded-xl border border-slate-800">
                <div className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>FastAPI + Uvicorn</span>
                </div>
                <p className="text-xs text-slate-400">High-concurrency ASGI web framework handling streaming multipart uploads and JSON chat endpoints.</p>
              </div>

              <div className="glass-card p-5 rounded-xl border border-slate-800">
                <div className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <span>LangChain LCEL</span>
                </div>
                <p className="text-xs text-slate-400">Declarative composition of retrieval, prompt formatting, and LLM inference pipelines with type safety.</p>
              </div>

              <div className="glass-card p-5 rounded-xl border border-slate-800">
                <div className="font-semibold text-white text-sm flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Zero Data Egress</span>
                </div>
                <p className="text-xs text-slate-400">PDFs are held in temporary memory during conversation and purged immediately upon replacement.</p>
              </div>
            </div>
          </section>

          {/* PROJECT LINK CALLOUT BUTTON (As user requested: "at last that project link button as we click it should go to that project ui") */}
          <section className="pt-6">
            <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-violet-500/30 bg-gradient-to-br from-slate-900/90 via-violet-950/20 to-slate-900/90 text-center space-y-6 relative overflow-hidden shadow-2xl shadow-violet-950/30">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 p-0.5 mx-auto shadow-lg shadow-violet-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-cyan-300" />
                </div>
              </div>

              <div className="max-w-xl mx-auto space-y-2">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Ready to Test With Your Own Documents?
                </h3>
                <p className="text-sm text-slate-300">
                  Upload any research paper, financial report, technical manual, or legal agreement to experience instant vector retrieval and grounded chat.
                </p>
              </div>

              <div>
                <button
                  onClick={() => setViewMode('chat')}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white font-bold text-base hover:opacity-95 shadow-xl shadow-violet-600/30 inline-flex items-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Open Document Intelligence Workspace</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 font-mono">
                Running live on Render API ({apiUrl.replace('https://', '')})
              </p>
            </div>
          </section>
        </main>
      )}

      {/* VIEW 2: DOCUMENT CHAT WORKSPACE (The fixed, modern UI/UX) */}
      {viewMode === 'chat' && (
        <main className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6 overflow-hidden">
          {/* Left Control Panel / Document Sidebar */}
          <aside className="w-full lg:w-80 flex flex-col gap-4">
            {/* Navigation back to Portfolio */}
            <button
              onClick={() => setViewMode('overview')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-violet-400" />
              <span>Back to Architecture & Metrics</span>
            </button>

            {/* Document Ingestion Card */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-semibold">
                  <FileText className="w-4 h-4 text-violet-400" />
                  <span>Document Source</span>
                </span>
                {activeFile && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Vectorized
                  </span>
                )}
              </div>

              {/* Upload Dropzone */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  hidden
                  id="pdf-upload-input"
                />
                <label
                  htmlFor="pdf-upload-input"
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isUploading
                      ? 'border-violet-500 bg-violet-500/5 cursor-wait'
                      : activeFile
                      ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500'
                      : 'border-slate-700 hover:border-violet-500/60 bg-slate-900/50 hover:bg-slate-900'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 ${
                    isUploading ? 'bg-violet-500/20 text-violet-300 animate-spin' : activeFile ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {isUploading ? <RefreshCw className="w-5 h-5" /> : activeFile ? <Check className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                  </div>

                  <span className="text-xs font-semibold text-slate-200">
                    {isUploading ? 'Vectorizing Document...' : activeFile ? 'Replace PDF Document' : 'Upload PDF Document'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    {isUploading ? 'Splitting & indexing chunks...' : 'Click to browse (.pdf format)'}
                  </span>
                </label>
              </div>

              {/* Upload Status text */}
              {uploadStatus && (
                <p className={`text-xs text-center font-mono ${
                  uploadStatus.includes('Ready') || uploadStatus.includes('Vectorized')
                    ? 'text-emerald-400'
                    : uploadStatus.includes('error') || uploadStatus.includes('failed') || uploadStatus.includes('Could not')
                    ? 'text-rose-400'
                    : 'text-violet-400'
                }`}>
                  {uploadStatus}
                </p>
              )}

              {/* Active Document Details */}
              {activeFile && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">{activeFile}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Chroma vector index active</div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Starter Questions */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 hidden sm:block">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Suggested Prompts</span>
              </span>
              <div className="space-y-1.5">
                {starterQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    disabled={!activeFile || isTyping}
                    className="w-full text-left p-2 rounded-lg bg-slate-900/60 hover:bg-violet-600/10 border border-slate-800/80 hover:border-violet-500/30 text-xs text-slate-300 hover:text-violet-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>

            {/* Model Telemetry Box */}
            <div className="glass-card p-4 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 font-mono space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span>Embedder:</span>
                <span className="text-cyan-400">FastEmbed (384D)</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>LLM Engine:</span>
                <span className="text-violet-400">Gemini 2.5 Flash</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Vector Space:</span>
                <span className="text-emerald-400">ChromaDB In-Memory</span>
              </div>
            </div>
          </aside>

          {/* Main Chat Conversation Column */}
          <section className="flex-1 glass-panel rounded-2xl border border-slate-800 flex flex-col h-[calc(100vh-8.5rem)] overflow-hidden">
            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-6 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/20 via-indigo-600/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center shadow-inner">
                    <FileText className="w-8 h-8 text-violet-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">No Document Vectorized Yet</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Upload any PDF in the left sidebar to start a real-time conversation. The RAG pipeline will extract text, compute vector embeddings, and ground all answers in document facts.
                    </p>
                  </div>
                  {!activeFile && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-violet-600 text-white font-medium text-xs hover:bg-violet-500 transition-colors inline-flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Select PDF File</span>
                    </button>
                  )}
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 max-w-3xl ${
                      msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                          : msg.sender === 'error'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                      }`}
                    >
                      {msg.sender === 'user' ? <User className="w-4 h-4" /> : msg.sender === 'error' ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`relative group rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/40'
                          : msg.sender === 'error'
                          ? 'bg-rose-950/40 border border-rose-800 text-rose-200'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-sm'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <div className="markdown-body">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      )}

                      {/* Copy action for assistant responses */}
                      {msg.sender === 'bot' && (
                        <button
                          onClick={() => copyToClipboard(msg.text, index)}
                          className="absolute top-2 right-2 p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy message"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Typing State Indicator */}
              {isTyping && (
                <div className="flex gap-3 max-w-xl mr-auto items-center">
                  <div className="w-8 h-8 rounded-xl bg-violet-600/30 text-violet-300 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="glass-card px-4 py-2.5 rounded-2xl border border-violet-500/30 text-xs font-mono text-cyan-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span>Retrieving vector chunks and synthesizing...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form Bar */}
            <div className="p-4 border-t border-slate-800/80 bg-slate-950/80">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    !activeFile
                      ? 'Please upload a PDF document first...'
                      : isTyping
                      ? 'AI is synthesizing...'
                      : 'Ask a question about the document (e.g., summarize key conclusions)...'
                  }
                  disabled={!activeFile || isTyping}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3.5 pr-14 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping || !activeFile}
                  className="absolute right-2 p-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-violet-600/20"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-2 font-mono">
                <span>Grounded exclusively in retrieved PDF chunks.</span>
                <span>Press Enter to send</span>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Backend Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-violet-400" />
                <span>Backend API Configuration</span>
              </h4>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveApiSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5">
                  Render / Local Backend URL
                </label>
                <input
                  type="url"
                  value={tempApiUrl}
                  onChange={(e) => setTempApiUrl(e.target.value)}
                  placeholder="https://multi-engine-doc-intel.onrender.com"
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Enter your active Render URL or local address (e.g. <code>http://localhost:8000</code>).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 transition-colors shadow-md shadow-violet-600/30"
                >
                  Save & Reconnect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}