
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from '../types';

export const GeminiChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...messages, userMessage].map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: "You are a psychologist who is more like a supportive, empathetic friend. You avoid clinical jargon. You are warm, direct, and slightly non-conformist. You specialize in life transitions and emotional support. Your name is 'The Modern Empathetic'. Keep answers concise (max 2-3 sentences) and very human.",
          temperature: 0.8,
        }
      });

      const aiText = response.text || "I'm here for you. Let's keep talking.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I lost my train of thought for a second. Try asking me again?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-[400px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-gray-400 italic text-sm text-center py-12">
            "How do you handle anxiety differently than a regular doctor?"
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`${m.role === 'user' ? 'ml-auto text-right' : 'mr-auto text-left'} max-w-[85%]`}>
            <div className={`inline-block p-4 text-sm ${m.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-[10px] mono animate-pulse uppercase tracking-widest text-gray-400">Typing...</div>
        )}
      </div>

      <div className="flex items-center space-x-2 border-t border-black/10 pt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask me a question..."
          className="flex-1 text-sm outline-none bg-transparent py-2"
        />
        <button 
          onClick={handleSend}
          disabled={isLoading}
          className="mono text-[10px] uppercase font-bold hover:underline disabled:opacity-30"
        >
          Send
        </button>
      </div>
    </div>
  );
};
