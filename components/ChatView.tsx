
import React, { useState, useRef, useEffect } from 'react';
import { getGeminiClient } from '../geminiService';
import { ChatMessage } from '../types';

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = getGeminiClient();
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: 'You are an expert AI assistant named Gemini Studio Pro. You are concise, helpful, and highly intelligent.'
        }
      });

      const result = await chat.sendMessageStream({ message: userMessage.text });
      
      let modelText = '';
      const modelId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, {
        id: modelId,
        role: 'model',
        text: '',
        timestamp: new Date()
      }]);

      for await (const chunk of result) {
        const chunkText = chunk.text || '';
        modelText += chunkText;
        setMessages(prev => prev.map(msg => 
          msg.id === modelId ? { ...msg, text: modelText } : msg
        ));
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I encountered an error processing your request. Please check your connection and try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full px-4 md:px-6">
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-8 space-y-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
            <div className="p-4 rounded-full bg-slate-800/50">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-lg font-medium">How can I help you today?</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {['Explain Quantum Physics', 'Write a Python script', 'Creative story ideas'].map(prompt => (
                <button 
                  key={prompt}
                  onClick={() => { setInput(prompt); handleSend(); }}
                  className="px-4 py-2 rounded-full border border-slate-700 text-sm hover:bg-slate-800 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                : 'bg-slate-800 text-slate-200 border border-slate-700'
            }`}>
              <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
              <div className={`text-[10px] mt-2 opacity-60 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pb-8 pt-4">
        <form onSubmit={handleSend} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-100 placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:bg-slate-700 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
