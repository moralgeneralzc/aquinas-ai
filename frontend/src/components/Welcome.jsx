import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, MessageCircle, GraduationCap, GitCompareArrows,
  Library, ChevronRight, Menu
} from 'lucide-react';
import Chat from './Chat';

export default function Welcome({ onStartChat, onToggleSidebar, sidebarOpen }) {
  const { profile } = useAuth();
  const [startedChat, setStartedChat] = useState(false);
  const [newConvId, setNewConvId] = useState(null);

  if (startedChat) {
    return <Chat conversationId={newConvId} onConversationCreated={(id) => setNewConvId(id)} />;
  }

  const features = [
    {
      icon: MessageCircle, title: 'Chat con IA Tomista',
      desc: 'Preguntá en español, busco en latín en 30.529 fragmentos y te respondo con citas exactas.',
      action: () => setStartedChat(true), available: true,
    },
    {
      icon: GraduationCap, title: 'Modo Socrático',
      desc: 'Te guío con preguntas mayéuticas para que descubras la doctrina por vos mismo.',
      action: () => setStartedChat(true),
      available: profile?.plan !== 'gratuito',
      badge: profile?.plan === 'gratuito' ? 'Studioso' : null,
    },
    {
      icon: Library, title: 'Navegador de Obras',
      desc: 'Explorá la Opera Omnia por obra, cuestión y artículo. Sin consumir créditos.',
      action: null, available: true, badge: 'Próximamente',
    },
    {
      icon: GitCompareArrows, title: 'Comparador de Textos',
      desc: 'Compará cómo Tomás trata un tema en distintas obras: Summa, Sentencias, De Veritate...',
      action: null,
      available: profile?.plan !== 'gratuito',
      badge: 'Próximamente',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto">
      <header className="shrink-0 px-5 py-3 border-b border-ivory-200 bg-white/60 backdrop-blur-sm flex items-center">
        {!sidebarOpen && (
          <button onClick={onToggleSidebar} className="p-1.5 mr-3 rounded-md hover:bg-ivory-200 text-manuscrito-400">
            <Menu className="w-5 h-5" />
          </button>
        )}
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-ivory-50/50">
        <div className="max-w-2xl w-full">
          {/* Hero */}
          <div className="text-center mb-12 fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl
                            bg-gradient-to-br from-ultramarine-100 to-halo-100
                            border border-ultramarine-200/60 mb-6 shadow-sm">
              <BookOpen className="w-10 h-10 text-ultramarine-600" />
            </div>
            <h1 className="text-4xl font-bold text-manuscrito-900 mb-3">Aquinas AI</h1>
            <p className="text-lg italic text-halo-700 mb-2">
              «Omne verum, a quocumque dicatur, a Spiritu Sancto est»
            </p>
            <p className="text-sm text-manuscrito-400">
              Toda verdad, dígala quien la diga, viene del Espíritu Santo — S.Th. I-II, q. 109, a. 1, ad 1
            </p>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {features.map(({ icon: Icon, title, desc, action, available, badge }) => (
              <button key={title} onClick={action} disabled={!action}
                className={`group text-left p-5 rounded-xl border transition-all duration-200
                  ${action
                    ? 'bg-white border-ivory-300 hover:border-ultramarine-300 hover:shadow-md cursor-pointer shadow-sm'
                    : 'bg-ivory-50/50 border-ivory-200 cursor-default opacity-60'
                  }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg border ${available ? 'bg-ultramarine-50 border-ultramarine-200' : 'bg-ivory-100 border-ivory-200'}`}>
                    <Icon className={`w-5 h-5 ${available ? 'text-ultramarine-600' : 'text-manuscrito-300'}`} />
                  </div>
                  {badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-halo-100 text-halo-700 border border-halo-200">
                      {badge}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-manuscrito-800 mb-1.5">{title}</h3>
                <p className="text-sm text-manuscrito-400 leading-relaxed">{desc}</p>
                {action && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-ultramarine-600
                                  group-hover:text-ultramarine-500 transition-colors">
                    Empezar <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 text-center">
            {[
              { value: '30.529', label: 'Fragmentos' },
              { value: '440+', label: 'Obras indexadas' },
              { value: '2048d', label: 'Embeddings NVIDIA' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-lg font-bold text-ultramarine-600">{value}</div>
                <div className="text-xs text-manuscrito-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
