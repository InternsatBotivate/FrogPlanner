import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Bot, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { runAssistant } from '../../lib/aiService';

export default function AIAssistant() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // Greet on load — the assistant works immediately after login (no key setup).
  useEffect(() => {
    if (user) {
      const firstName = (user.full_name || user.username || 'there').split(' ')[0];
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: `Hi ${firstName}! 👋 I'm your Frog Assistant. I can tell you about FrogPlanner, read your planner, create and update tasks, manage your projects, and summarize your day. What would you like to do?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || sending || !user?.id) return;

    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: query, timestamp: new Date() };
    const history = [...messages, userMsg];
    setMessages(history);
    if (!textToSend) setInput('');
    setSending(true);

    try {
      // Pass the running conversation so the model has context.
      const replyText = await runAssistant({
        user,
        messages: history
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
      });
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, sender: 'bot', text: replyText, timestamp: new Date() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: err?.message || 'Sorry, the AI Assistant failed. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    'What is FrogPlanner?',
    'What is pending today?',
    'Show my morning tasks',
    'Add "Coffee Break" tomorrow afternoon under Personal',
    'Summarize my week',
  ];

  return (
    <div className="p-0 sm:p-2 md:p-6 flex flex-col h-full min-h-0">
      
      {/* Container wrapping the Chat view */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-800 uppercase tracking-tight">AI Planner Assistant</h2>
              <p className="text-[10px] text-gray-400">Powered by FrogPlanner AI</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (user) {
                const firstName = (user.full_name || user.username || 'there').split(' ')[0];
                setMessages([
                  {
                    id: 'welcome',
                    sender: 'bot',
                    text: `Chat refreshed! How can I help you with your day, ${firstName}?`,
                    timestamp: new Date()
                  }
                ]);
              }
            }}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
            title="Clear Chat History"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Chat Messages Panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
          {messages.map(msg => (
            <div 
              key={msg.id} 
              className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-indigo-50 border-indigo-100 text-indigo-700 font-bold text-xs' 
                  : 'bg-white border-gray-200 text-gray-600'
              }`}>
                {msg.sender === 'user' ? (user?.name?.charAt(0).toUpperCase() || 'U') : <Bot size={16} className="text-indigo-600" />}
              </div>

              {/* Message Content Bubble */}
              <div className={`rounded-xl p-3 text-xs md:text-sm border shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-indigo-600 border-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white border-gray-200 text-gray-700 rounded-tl-none'
              }`}>
                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                <span className={`block text-[8px] mt-1 text-right ${
                  msg.sender === 'user' ? 'text-indigo-200' : 'text-gray-400'
                }`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {sending && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border shadow-sm bg-white border-gray-200 text-gray-600">
                <Bot size={16} className="text-indigo-600" />
              </div>
              <div className="rounded-xl rounded-tl-none p-3 border shadow-sm bg-white border-gray-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts Panel */}
        <div className="p-3 border-t border-gray-150 bg-white flex flex-wrap gap-2">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              disabled={sending}
              className="px-3 py-1 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-full text-[10px] md:text-xs font-semibold transition active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50/30 disabled:hover:text-indigo-700"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Text Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="p-3 border-t border-gray-200 bg-white flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder={sending ? 'Frog Assistant is thinking…' : 'Ask about FrogPlanner or your tasks…'}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 text-xs md:text-sm shadow-inner bg-gray-50/50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition active:scale-95 shadow-sm flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </form>

      </div>

    </div>
  );
}
