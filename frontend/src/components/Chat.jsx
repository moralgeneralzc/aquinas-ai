import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  Send, Loader2, BookOpenCheck, GraduationCap,
  MessageCircle, AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Chat({ conversationId, onConversationCreated }) {
  const { profile, refreshProfile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState('chat');
  const [error, setError] = useState('');
  const [currentConvId, setCurrentConvId] = useState(conversationId);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
      setCurrentConvId(conversationId);
    } else {
      setMessages([]);
      setCurrentConvId(null);
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages(convId) {
    try {
      setLoading(true);
      const { conversation, messages: msgs } = await api.getConversationMessages(convId);
      setMessages(msgs.map(m => ({
        role: m.role, content: m.content,
        sources: m.sources ? JSON.parse(m.sources) : [],
      })));
      if (conversation.mode) setMode(conversation.mode);
    } catch (e) { console.error('Error loading messages:', e); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMessage = input.trim();
    setInput('');
    setError('');

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setStreaming(true);
    let assistantContent = '';
    let sources = [];

    setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [] }]);

    try {
      for await (const chunk of api.chatStream(userMessage, currentConvId, mode)) {
        if (chunk.error) { setError(chunk.error); break; }
        if (chunk.content) {
          assistantContent += chunk.content;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: assistantContent, sources: [] };
            return updated;
          });
        }
        if (chunk.done) {
          sources = chunk.sources || [];
          if (chunk.conversation_id && !currentConvId) {
            setCurrentConvId(chunk.conversation_id);
            onConversationCreated?.(chunk.conversation_id);
          }
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: assistantContent, sources };
            return updated;
          });
          refreshProfile();
        }
      }
    } catch (err) {
      if (err.status === 429) setError('Sin créditos disponibles. Se resetean mañana o podés mejorar tu plan.');
      else if (err.status === 403) setError(err.error || 'Esta función requiere un plan superior.');
      else setError(err.error || 'Error al procesar la consulta.');
      if (!assistantContent) setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  const modes = [
    { id: 'chat', icon: MessageCircle, label: 'Chat' },
    { id: 'socratico', icon: GraduationCap, label: 'Socrático' },
  ];

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Top bar */}
      <header className="shrink-0 px-5 py-3 border-b border-ivory-200 bg-white/60 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-ivory-100 border border-ivory-200">
          {modes.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setMode(id)}
              disabled={id === 'socratico' && profile?.plan === 'gratuito'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all
                ${mode === id
                  ? 'bg-ultramarine-600 text-white shadow-sm'
                  : 'text-manuscrito-400 hover:text-manuscrito-600'
                }
                ${id === 'socratico' && profile?.plan === 'gratuito' ? 'opacity-40 cursor-not-allowed' : ''}
              `}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        {mode === 'socratico' && (
          <span className="text-xs text-halo-600 italic">Maieutica — el arte de preguntar</span>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-ivory-50/50">
        <div className="max-w-3xl mx-auto space-y-5">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 text-manuscrito-300 animate-spin mx-auto" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 fade-in">
              <BookOpenCheck className="w-12 h-12 text-ivory-400 mx-auto mb-4" />
              <h2 className="text-xl text-manuscrito-700 mb-2">
                {mode === 'socratico' ? 'Modo Socrático' : 'Preguntá sobre Santo Tomás'}
              </h2>
              <p className="text-manuscrito-400 text-sm max-w-md mx-auto">
                {mode === 'socratico'
                  ? 'Te voy a guiar con preguntas para que descubras la respuesta por vos mismo, como lo haría un buen maestro tomista.'
                  : 'Podés preguntar en español sobre cualquier tema del Corpus Thomisticum. Busco en 30.529 fragmentos de la Opera Omnia.'}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  '¿Qué dice Tomás sobre la existencia de Dios?',
                  '¿Cómo distingue acto y potencia?',
                  '¿Qué es la ley natural según la Summa?',
                ].map(q => (
                  <button key={q} onClick={() => setInput(q)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-ivory-300
                               text-xs text-manuscrito-500 hover:text-ultramarine-600 hover:border-ultramarine-200
                               transition-all shadow-sm">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`slide-up flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="assistant-markdown">
                      <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  {msg.sources?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-ivory-200">
                      <p className="text-xs text-manuscrito-400 mb-1.5">Fuentes consultadas:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((s, j) => (
                          <span key={j} className="source-chip">
                            <BookOpenCheck className="w-3 h-3" />
                            {s.obra} — {s.referencia}
                            {s.similarity && <span className="text-halo-600 ml-1">{s.similarity}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {streaming && (
            <div className="flex items-center gap-2 text-manuscrito-400 text-sm pl-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="italic">Quaerens in Corpore Thomistico...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2">
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-sm bg-fresco-50
                          border border-fresco-200 rounded-lg px-4 py-2.5 text-fresco-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            {error.includes('créditos') && (
              <button className="ml-auto text-ultramarine-600 hover:text-ultramarine-500 font-bold text-xs">
                Mejorar plan
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-4 py-4 border-t border-ivory-200 bg-white/60 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
          <div className="flex-1 relative">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'socratico'
                ? 'Planteá un tema para la discusión socrática...'
                : 'Preguntá sobre Santo Tomás de Aquino...'}
              className="input-field pr-12" disabled={streaming} />
            <button type="submit" disabled={!input.trim() || streaming}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md
                         bg-ultramarine-600 hover:bg-ultramarine-500 text-white
                         disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
        <p className="text-center text-xs text-manuscrito-300 mt-2">
          Basado en el Corpus Thomisticum · 30.529 fragmentos · Opera Omnia
        </p>
      </div>
    </div>
  );
}
