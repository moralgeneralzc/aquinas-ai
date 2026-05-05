import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight,
  LogOut, Sparkles, BookOpen, Home, Library, GitCompareArrows,
  Lock, History
} from 'lucide-react';

const PLAN_LABELS = {
  gratuito: { label: 'Gratis', color: 'text-manuscrito-500', bg: 'bg-ivory-300' },
  studioso: { label: 'Studioso', color: 'text-halo-800', bg: 'bg-halo-100' },
  doctor: { label: 'Doctor', color: 'text-ultramarine-700', bg: 'bg-ultramarine-100' },
};

export default function Sidebar({
  isOpen, onToggle,
  currentView, activeConversation,
  onSelectConversation, onNewChat, onGoToView,
  refreshKey
}) {
  const { profile, signOut } = useAuth();
  const isPaid = profile?.plan !== 'gratuito';

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConversations(); }, [refreshKey]);

  async function loadConversations() {
    try {
      const { conversations: convs } = await api.getConversations();
      setConversations(convs);
    } catch (e) { console.error('Error loading conversations:', e); }
    finally { setLoading(false); }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta conversación?')) return;
    try {
      await api.deleteConversation(id);
      setConversations(c => c.filter(conv => conv.id !== id));
      if (activeConversation === id) onNewChat();
    } catch (e) { console.error('Error deleting:', e); }
  }

  const planInfo = PLAN_LABELS[profile?.plan || 'gratuito'];

  const tools = [
    {
      key: 'welcome', icon: Home, label: 'Inicio',
      onClick: () => onGoToView('welcome'),
      active: currentView === 'welcome',
    },
    {
      key: 'browser', icon: Library, label: 'Navegador de Obras',
      onClick: () => onGoToView('browser'),
      active: currentView === 'browser',
    },
    {
      key: 'comparador', icon: GitCompareArrows, label: 'Comparador de Textos',
      onClick: () => onGoToView('comparador'),
      active: currentView === 'comparador',
      locked: !isPaid,
    },
  ];

  return (
    <>
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-30 p-2 rounded-lg bg-white border border-ivory-300
                     text-manuscrito-500 hover:text-manuscrito-700 shadow-sm transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <aside className={`${isOpen ? 'w-72' : 'w-0'} shrink-0 h-screen flex flex-col
                          bg-white border-r border-ivory-300 transition-all duration-300 overflow-hidden`}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-ivory-200">
          <button
            onClick={() => onGoToView('welcome')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <BookOpen className="w-5 h-5 text-ultramarine-600" />
            <span className="font-bold text-manuscrito-800 text-base">Aquinas AI</span>
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-ivory-200 text-manuscrito-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New chat */}
        <div className="p-3">
          <button
            onClick={onNewChat}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Nueva conversación
          </button>
        </div>

        {/* Herramientas */}
        <div className="px-2 pb-2">
          <div className="px-2 pt-1 pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-manuscrito-400">
              Herramientas
            </span>
          </div>
          <div className="space-y-0.5">
            {tools.map(({ key, icon: Icon, label, onClick, active, locked }) => (
              <button
                key={key}
                onClick={onClick}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left
                            transition-all duration-150 text-sm
                            ${active
                              ? 'bg-ultramarine-50 border border-ultramarine-200/60 text-manuscrito-800'
                              : 'hover:bg-ivory-200/60 text-manuscrito-500 hover:text-manuscrito-700 border border-transparent'
                            }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-ultramarine-600' : ''}`} />
                <span className="flex-1 truncate">{label}</span>
                {locked && <Lock className="w-3 h-3 text-halo-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Conversaciones */}
        <div className="px-2 pb-1">
          <div className="px-2 pt-2 pb-1.5 flex items-center gap-1.5">
            <History className="w-3 h-3 text-manuscrito-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-manuscrito-400">
              Conversaciones
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {loading ? (
            <div className="text-center py-6">
              <div className="w-5 h-5 border-2 border-ivory-400 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-6 px-3">
              <Sparkles className="w-6 h-6 text-ivory-400 mx-auto mb-2" />
              <p className="text-xs text-manuscrito-400">
                Empezá una conversación
              </p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full group flex items-center gap-2.5 px-3 py-2 rounded-lg text-left
                           transition-all duration-150 text-sm
                           ${activeConversation === conv.id && currentView === 'chat'
                             ? 'bg-ultramarine-50 border border-ultramarine-200/60 text-manuscrito-800'
                             : 'hover:bg-ivory-200/60 text-manuscrito-500 hover:text-manuscrito-700 border border-transparent'
                           }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-40" />
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-ivory-300
                             text-manuscrito-300 hover:text-fresco-600 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))
          )}
        </div>

        {/* Credits & Profile */}
        <div className="p-3 border-t border-ivory-200 space-y-3">
          {profile && (
            <div className="px-3 py-2.5 rounded-lg bg-ivory-50 border border-ivory-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-manuscrito-400">Créditos hoy</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${planInfo.bg} ${planInfo.color}`}>
                  {planInfo.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-manuscrito-800">
                  {profile.plan === 'doctor' ? '∞' : profile.credits_remaining}
                </span>
                {profile.plan !== 'doctor' && (
                  <span className="text-xs text-manuscrito-300">/ {profile.plan_limits?.daily_credits || 10}</span>
                )}
              </div>
              {profile.plan !== 'doctor' && (
                <div className="mt-1.5 h-1.5 rounded-full bg-ivory-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-ultramarine-500 to-halo-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (profile.credits_remaining / (profile.plan_limits?.daily_credits || 10)) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-ultramarine-100 border border-ultramarine-200
                            flex items-center justify-center text-sm font-bold text-ultramarine-700">
              {profile?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-manuscrito-700 truncate">{profile?.display_name}</div>
            </div>
            <button
              onClick={signOut}
              title="Cerrar sesión"
              className="p-1.5 rounded-md hover:bg-ivory-200 text-manuscrito-400 hover:text-manuscrito-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}