import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Welcome from './components/Welcome';
import Browser from './components/Browser';
import Comparador from './components/Comparador';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('welcome'); // welcome | chat | browser | comparador
  const [activeConversation, setActiveConversation] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-ivory-100">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-ultramarine-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-manuscrito-400 italic text-lg">Praeparamus...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  function goToView(view) {
    setCurrentView(view);
    if (view !== 'chat') setActiveConversation(null);
  }

  function selectConversation(id) {
    setActiveConversation(id);
    setCurrentView('chat');
  }

  function startNewChat() {
    setActiveConversation(null);
    setCurrentView('chat');
  }

  function backToWelcome() {
    setActiveConversation(null);
    setCurrentView('welcome');
  }

  return (
    <div className="h-screen flex bg-ivory-100 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentView={currentView}
        activeConversation={activeConversation}
        onSelectConversation={selectConversation}
        onNewChat={startNewChat}
        onGoToView={goToView}
        refreshKey={refreshKey}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {currentView === 'browser' ? (
          <Browser
            onBack={backToWelcome}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
          />
        ) : currentView === 'comparador' ? (
          <Comparador
            onBack={backToWelcome}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
          />
        ) : currentView === 'chat' ? (
          <Chat
            conversationId={activeConversation}
            onConversationCreated={(id) => {
              setActiveConversation(id);
              setRefreshKey(k => k + 1);
            }}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
          />
        ) : (
          <Welcome
            onStartChat={startNewChat}
            onOpenBrowser={() => goToView('browser')}
            onOpenComparador={() => goToView('comparador')}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}