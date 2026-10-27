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
  ShieldCheck,
  Zap,
  Cpu,
  Database,
  Layers,
  Terminal,
  RefreshCw,
  Settings,
  Bot,
  User,
  AlertCircle,
  ExternalLink,
  Activity,
  CheckCircle2
} from 'lucide-react';

export default function App() {
  // Navigation: 'overview' (System Architecture & Portfolio) or 'chat' (Interactive Document Workbench)
  const [viewMode, setViewMode] = useState('overview');

  // Backend API configuration - dynamically resolved from Vite environment variables or localStorage
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
        setUploadStatus('Vectorized & Ready for Analysis');
        setViewMode('chat');
        setMessages([
          {
            sender: 'bot',
            text: `📄 **Document Vectorized:** \`${file.name}\`\n\nText segments have been embedded into the in-memory ChromaDB vector store using local FastEmbed (BAAI/bge-small-en-v1.5). You can now ask questions, request bulleted summaries, or perform semantic data extraction.`
          }
        ]);
      } else {
        const errData = await response.json().catch(() => ({}));
        setUploadStatus(errData.detail || 'Upload failed.');
        setActiveFile('');
      }
    } catch {
      setUploadStatus('Could not reach backend API. Verify Render endpoint.');
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
        { text: '⚠️ Unable to reach backend. If the free-tier container is waking up, please retry in 15 seconds.', sender: 'error' }
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
    'What are the primary conclusions or metrics stated?',
    'Identify any critical dates, deadlines, or timelines.',
    'Extract all limitations, caveats, or risks stated in the text.'
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col font-sans selection:bg-zinc-800 selection:text-white subtle-grid">
      {/* Top Application Header - Linear Minimalist Style */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#09090b]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none" 
            onClick={() => setViewMode('overview')}
          >
            <div className="w-8 h-8 rounded-lg bg-[#16171a] border border-white/10 flex items-center justify-center text-zinc-200">
              <FileText className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white">DocIntel</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                v2.4
              </span>
            </div>
          </div>

          {/* Mode Switcher Tabs - Linear Segmented Control */}
          <nav className="flex items-center bg-[#121316] p-1 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setViewMode('overview')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'overview'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Architecture & Blueprint</span>
            </button>
            <button
              onClick={() => setViewMode('chat')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all relative ${
                viewMode === 'chat'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Document Workbench</span>
              {activeFile && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Document Loaded"></span>
              )}
            </button>
          </nav>

          {/* Status & Settings */}
          <div className="flex items-center gap-2.5">
            {/* Backend Health Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
                backendStatus === 'online'
                  ? 'bg-zinc-900/80 text-emerald-400 border-emerald-500/20'
                  : backendStatus === 'checking'
                  ? 'bg-zinc-900/80 text-amber-400 border-amber-500/20'
                  : 'bg-zinc-900/80 text-rose-400 border-rose-500/20'
              }`}
              title={`API target: ${apiUrl}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendStatus === 'online'
                    ? 'bg-emerald-400'
                    : backendStatus === 'checking'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-400'
                }`}
              ></span>
              <span className="text-[11px]">
                {backendStatus === 'online' ? 'Online' : backendStatus === 'checking' ? 'Connecting' : 'API Sleeping'}
              </span>
            </div>

            {/* Settings Trigger */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-md bg-[#121316] border border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:border-white/20 transition-colors"
              title="Configure API Endpoint"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* VIEW 1: PORTFOLIO & ARCHITECTURE SHOWCASE (Engineering Blueprint) */}
      {viewMode === 'overview' && (
        <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
          {/* Hero Section */}
          <section className="space-y-4 pt-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#121316] border border-white/[0.08] text-zinc-400 text-xs font-mono">
              <Activity className="w-3.5 h-3.5 text-zinc-300" />
              <span>SYSTEM SPECIFICATION // RAG INFERENCE PIPELINE</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight leading-tight">
              Enterprise Document Intelligence Engine
            </h1>

            <p className="text-zinc-400 text-base leading-relaxed max-w-3xl">
              An architectural implementation for grounded document reasoning. Orchestrates in-memory 
              PyPDF extraction, local <strong className="text-zinc-200 font-medium">FastEmbed 384D</strong> vectorization via ONNX runtime, 
              ephemeral <strong className="text-zinc-200 font-medium">ChromaDB</strong> cosine similarity indexing, and 
              <strong className="text-zinc-200 font-medium"> Google Gemini Flash</strong> synthesis with zero server disk persistence.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setViewMode('chat')}
                className="px-5 py-2.5 rounded-lg bg-zinc-100 text-zinc-950 font-medium text-xs hover:bg-white transition-colors inline-flex items-center gap-2"
              >
                <span>Launch Document Workbench</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <a
                href="#pipeline-blueprint"
                className="px-4 py-2.5 rounded-lg bg-[#121316] border border-white/[0.08] text-zinc-300 font-medium text-xs hover:text-white hover:border-white/20 transition-colors inline-flex items-center gap-2"
              >
                <span>View Technical Flow</span>
              </a>
              <a
                href="https://github.com/Naveenbnnavee/Multi-Engine-Doc-Intel"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-lg bg-[#121316] border border-white/[0.08] text-zinc-300 font-medium text-xs hover:text-white hover:border-white/20 transition-colors inline-flex items-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                <span>GitHub Repository</span>
              </a>
            </div>
          </section>

          {/* Key Metrics / System Invariants */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="linear-panel p-5 rounded-xl">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-zinc-300" /> Ingestion Time
              </div>
              <div className="text-2xl font-semibold text-white font-mono tracking-tight">&lt; 180ms</div>
              <p className="text-xs text-zinc-500 mt-2">In-memory PyPDF parsing with 1000c/200o chunk windowing.</p>
            </div>

            <div className="linear-panel p-5 rounded-xl">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Database className="w-3.5 h-3.5 text-zinc-300" /> Vector Space
              </div>
              <div className="text-2xl font-semibold text-white font-mono tracking-tight">384-Dim</div>
              <p className="text-xs text-zinc-500 mt-2">Dense cosine semantic space via BAAI/bge-small-en-v1.5.</p>
            </div>

            <div className="linear-panel p-5 rounded-xl">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" /> Data Isolation
              </div>
              <div className="text-2xl font-semibold text-white font-mono tracking-tight">Zero Disk</div>
              <p className="text-xs text-zinc-500 mt-2">Ephemeral vector collections purged upon session termination.</p>
            </div>

            <div className="linear-panel p-5 rounded-xl">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Cpu className="w-3.5 h-3.5 text-zinc-300" /> LLM Engine
              </div>
              <div className="text-2xl font-semibold text-white font-mono tracking-tight">Gemini Flash</div>
              <p className="text-xs text-zinc-500 mt-2">Deterministic retrieval-grounded synthesis (temp 0.3).</p>
            </div>
          </section>

          {/* Pipeline Blueprint & Architecture Flow */}
          <section id="pipeline-blueprint" className="space-y-4 pt-4">
            <div className="border-b border-white/[0.08] pb-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Architecture Pipeline</div>
                <h2 className="text-xl font-semibold text-white mt-1">End-to-End Processing Workflow</h2>
              </div>
              <span className="text-xs font-mono text-zinc-500">4-Stage Execution</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="linear-card p-5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500">STAGE 01</span>
                  <FileText className="w-4 h-4 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">PDF Ingestion</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  PyPDF loads the binary into memory. RecursiveCharacterTextSplitter shards content into 1,000-character chunks with 200-character semantic boundary overlap.
                </p>
              </div>

              <div className="linear-card p-5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500">STAGE 02</span>
                  <Cpu className="w-4 h-4 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Local Embeddings</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  FastEmbed ONNX engine runs directly inside the ASGI worker process. Generates 384-dimensional dense vectors with zero outbound external API latency.
                </p>
              </div>

              <div className="linear-card p-5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500">STAGE 03</span>
                  <Database className="w-4 h-4 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">ChromaDB Index</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  In-memory Chroma collection computes cosine similarity over document segments. Returns the top-5 most relevant passages for every user prompt in &lt;50ms.
                </p>
              </div>

              <div className="linear-card p-5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500">STAGE 04</span>
                  <Terminal className="w-4 h-4 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">LangChain Synthesis</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  LCEL chain injects retrieved chunks into a strict system prompt. Google Gemini Flash synthesizes clean markdown answers strictly from document facts.
                </p>
              </div>
            </div>
          </section>

          {/* Technical Specifications Table */}
          <section className="space-y-4">
            <div className="border-b border-white/[0.08] pb-3">
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Subsystem Invariants</div>
              <h3 className="text-lg font-semibold text-white mt-1">Component Design Decisions</h3>
            </div>

            <div className="linear-panel rounded-xl overflow-hidden border border-white/[0.08]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#16171a] border-b border-white/[0.08] text-zinc-400 font-mono">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Subsystem</th>
                    <th className="py-2.5 px-4 font-medium">Implementation</th>
                    <th className="py-2.5 px-4 font-medium hidden sm:table-cell">Design Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                  <tr>
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                      <span>API Layer</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">FastAPI + Uvicorn ASGI</td>
                    <td className="py-3 px-4 text-zinc-400 hidden sm:table-cell">Asynchronous non-blocking file streaming and low-overhead JSON query endpoints.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Embedding Model</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">FastEmbed (bge-small-en-v1.5)</td>
                    <td className="py-3 px-4 text-zinc-400 hidden sm:table-cell">Quantized ONNX inference eliminates paid embedding API calls and network latency.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Vector Index</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">ChromaDB Ephemeral Collection</td>
                    <td className="py-3 px-4 text-zinc-400 hidden sm:table-cell">Zero disk persistence safeguards sensitive corporate documents from permanent retention.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      <span>LLM Orchestration</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">LangChain LCEL Chains</td>
                    <td className="py-3 px-4 text-zinc-400 hidden sm:table-cell">Strict context boundary enforcement prevents hallucinated outputs outside retrieved context.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* PROJECT LAUNCH CALLOUT (Directly transitions to the Document Workbench) */}
          <section className="pt-2">
            <div className="linear-panel p-6 sm:p-8 rounded-xl border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1.5 text-center sm:text-left">
                <h3 className="text-lg font-semibold text-white">
                  Ready to test with your own documents?
                </h3>
                <p className="text-xs text-zinc-400 max-w-xl">
                  Upload any PDF (research report, contract, financial statement, or technical manual) to verify in-memory vectorization and grounded conversational retrieval.
                </p>
                <div className="text-[11px] font-mono text-zinc-500 pt-1">
                  Active Endpoint: {apiUrl.replace('https://', '')}
                </div>
              </div>

              <button
                onClick={() => setViewMode('chat')}
                className="px-6 py-3 rounded-lg bg-zinc-100 text-zinc-950 font-medium text-xs hover:bg-white transition-all flex items-center gap-2 flex-shrink-0"
              >
                <span>Open Document Workbench</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </main>
      )}

      {/* VIEW 2: DOCUMENT CHAT WORKSPACE (IDE Split View) */}
      {viewMode === 'chat' && (
        <main className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-4 sm:p-6 gap-4 overflow-hidden">
          {/* Left Control Panel / Document Sidebar */}
          <aside className="w-full lg:w-80 flex flex-col gap-3">
            {/* Back Button */}
            <button
              onClick={() => setViewMode('overview')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#121316] border border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/20 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
              <span>Back to Architecture Blueprint</span>
            </button>

            {/* Document Ingestion Card */}
            <div className="linear-panel p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-medium">
                  <FileText className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Document Source</span>
                </span>
                {activeFile && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
                  className={`border border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isUploading
                      ? 'border-zinc-500 bg-zinc-900/40 cursor-wait'
                      : activeFile
                      ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                      : 'border-zinc-800 hover:border-zinc-600 bg-[#16171a]/50 hover:bg-[#16171a]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                    isUploading 
                      ? 'bg-zinc-800 text-zinc-300 animate-spin' 
                      : activeFile 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'bg-zinc-900 text-zinc-400'
                  }`}>
                    {isUploading ? <RefreshCw className="w-4 h-4" /> : activeFile ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  </div>

                  <span className="text-xs font-medium text-zinc-200">
                    {isUploading ? 'Vectorizing Chunks...' : activeFile ? 'Replace PDF Document' : 'Upload PDF Document'}
                  </span>
                  <span className="text-[11px] text-zinc-500 mt-1">
                    {isUploading ? 'Splitting & ONNX embedding...' : 'Click to select local .pdf'}
                  </span>
                </label>
              </div>

              {/* Upload Status text */}
              {uploadStatus && (
                <p className={`text-xs text-center font-mono ${
                  uploadStatus.includes('Ready') || uploadStatus.includes('Vectorized')
                    ? 'text-emerald-400'
                    : uploadStatus.includes('failed') || uploadStatus.includes('Could not')
                    ? 'text-rose-400'
                    : 'text-zinc-400'
                }`}>
                  {uploadStatus}
                </p>
              )}

              {/* Active Document Details */}
              {activeFile && (
                <div className="p-2.5 rounded-lg bg-[#16171a] border border-white/[0.06] flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-zinc-900 text-zinc-300">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-200 truncate">{activeFile}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">Chroma vector index active</div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Starter Prompts */}
            <div className="linear-panel p-4 rounded-xl space-y-2.5 hidden sm:block">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-medium">
                <Terminal className="w-3.5 h-3.5 text-zinc-300" />
                <span>Suggested Prompts</span>
              </span>
              <div className="space-y-1">
                {starterQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    disabled={!activeFile || isTyping}
                    className="w-full text-left p-2 rounded-md bg-[#16171a] hover:bg-zinc-800 border border-white/[0.04] text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>

            {/* Telemetry Status Box */}
            <div className="linear-card p-3 rounded-lg text-[11px] text-zinc-400 font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Embedder:</span>
                <span className="text-zinc-200">FastEmbed 384D</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Synthesis:</span>
                <span className="text-zinc-200">Gemini Flash</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Vector DB:</span>
                <span className="text-emerald-400">ChromaDB In-Memory</span>
              </div>
            </div>
          </aside>

          {/* Main Chat Conversation Column */}
          <section className="flex-1 linear-panel rounded-xl flex flex-col h-[calc(100vh-7.5rem)] overflow-hidden">
            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto p-6 space-y-3">
                  <div className="w-12 h-12 rounded-lg bg-[#16171a] border border-white/[0.08] flex items-center justify-center text-zinc-400">
                    <FileText className="w-6 h-6 text-zinc-300" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">No Document Vectorized Yet</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Upload a PDF in the left sidebar. The pipeline will parse text, compute embeddings, and ground answers strictly in retrieved chunks.
                    </p>
                  </div>
                  {!activeFile && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-lg bg-zinc-100 text-zinc-950 font-medium text-xs hover:bg-white transition-colors inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
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
                    {/* Minimalist Avatar */}
                    <div
                      className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                        msg.sender === 'user'
                          ? 'bg-zinc-800 text-zinc-200 border border-white/10'
                          : msg.sender === 'error'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-[#16171a] text-zinc-300 border border-white/[0.08]'
                      }`}
                    >
                      {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : msg.sender === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`relative group rounded-xl px-4 py-3 text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-zinc-800 text-white border border-white/[0.08]'
                          : msg.sender === 'error'
                          ? 'bg-rose-950/20 border border-rose-900/50 text-rose-200'
                          : 'bg-[#16171a] border border-white/[0.06] text-zinc-300'
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
                          className="absolute top-2 right-2 p-1 rounded bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/[0.06]"
                          title="Copy response"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Typing State Indicator */}
              {isTyping && (
                <div className="flex gap-2.5 max-w-xl mr-auto items-center">
                  <div className="w-7 h-7 rounded-lg bg-[#16171a] border border-white/[0.08] text-zinc-400 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="linear-card px-3 py-2 rounded-lg text-xs font-mono text-zinc-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse"></span>
                    <span>Synthesizing grounded response...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form Bar */}
            <div className="p-3 sm:p-4 border-t border-white/[0.08] bg-[#09090b]/80">
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
                      ? 'Upload a PDF document first...'
                      : isTyping
                      ? 'Synthesizing response...'
                      : 'Ask a question about the document...'
                  }
                  disabled={!activeFile || isTyping}
                  className="w-full bg-[#121316] border border-white/[0.08] focus:border-white/20 rounded-lg px-3.5 py-2.5 pr-12 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed font-sans"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping || !activeFile}
                  className="absolute right-1.5 p-1.5 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Send query"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1 pt-2 font-mono">
                <span>Grounded in retrieved PDF vectors. Zero server disk retention.</span>
                <span>Enter ↵</span>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Backend Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#121316] border border-white/[0.08] rounded-xl p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-zinc-400" />
                <span>Backend API Configuration</span>
              </h4>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs p-1 rounded hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveApiSettings} className="space-y-3.5">
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1">
                  Active Backend URL
                </label>
                <input
                  type="url"
                  value={tempApiUrl}
                  onChange={(e) => setTempApiUrl(e.target.value)}
                  placeholder="https://multi-engine-doc-intel.onrender.com"
                  required
                  className="w-full bg-[#16171a] border border-white/[0.08] focus:border-white/20 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Target Render service URL or local address (e.g. <code>http://localhost:8000</code>).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3 py-1.5 rounded-md bg-[#16171a] border border-white/[0.08] text-zinc-300 text-xs hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-zinc-100 text-zinc-950 text-xs font-medium hover:bg-white transition-colors"
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