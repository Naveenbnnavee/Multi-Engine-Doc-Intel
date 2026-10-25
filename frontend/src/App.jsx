import { useState, useRef, useEffect } from 'react';
import './App.css';
import Markdown from 'react-markdown'

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [activeFile, setActiveFile] = useState(''); // Tracks the current PDF name
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setActiveFile(file.name);
    setIsUploading(true);
    setUploadStatus('Analyzing document...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('https://pdf-chatter-ouph.onrender.com/upload', {
        method: 'POST',
        body: formData,
        });
      
      if (response.ok) {
        setUploadStatus('Ready to chat!');
      } else {
        setUploadStatus('Upload failed.');
        setActiveFile('');
      }
    } catch (error) {
      setUploadStatus('Server connection error.');
      setActiveFile('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('https://pdf-chatter-ouph.onrender.com/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage.text }),
      });;

      const data = await response.json();
      
      if (response.ok) {
        setMessages((prev) => [...prev, { text: data.answer, sender: 'bot' }]);
      } else {
        setMessages((prev) => [...prev, { text: data.detail || 'Error', sender: 'error' }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { text: 'Check if backend is running.', sender: 'error' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2>PDF Chatter</h2>
        <div className="upload-section">
          <label className="upload-btn">
            {isUploading ? 'Processing...' : 'Upload PDF'}
            <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={isUploading} hidden />
          </label>
          <p className="status-text">{uploadStatus}</p>
          
          {activeFile && !isUploading && (
            <div className="file-badge fade-in">
              <span className="file-icon">📄</span>
              <span className="file-name">{activeFile}</span>
            </div>
          )}
        </div>
      </aside>

      <main className="chat-area">
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-state">
              <h3>Welcome</h3>
              <p>Upload a PDF to start a conversation with the AI.</p>
            </div>
          )}
        {messages.map((msg, index) => (
  <div key={index} className={`message-row ${msg.sender}`}>
    <div className={`message-bubble ${msg.sender}`}>
      {/* CHANGE THIS LINE FROM {msg.text} TO THE ONE BELOW */}
      <Markdown>{msg.text}</Markdown>
    </div>
  </div>
))}
          {isTyping && (
            <div className="message-row bot">
              <div className="message-bubble bot typing pulse">AI is reading...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="input-form" onSubmit={handleSendMessage}>
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the document..."
              disabled={isTyping || !activeFile}
            />
            <button type="submit" disabled={!input.trim() || isTyping || !activeFile}>
              Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default App;