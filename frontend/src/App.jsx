import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Welcome from './components/Welcome';

function AppContent() {
  const { user, loading } = useAuth();
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

  return (
    <div className="h-screen flex bg-ivory-100 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeConversation={activeConversation}
        onSelectConversation={setActiveConversation}
        onNewChat={() => setActiveConversation(null)}
        refreshKey={refreshKey}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {activeConversation ? (
          <Chat
            conversationId={activeConversation}
            onConversationCreated={(id) => {
              setActiveConversation(id);
              setRefreshKey(k => k + 1);
            }}
          />
        ) : (
          <Welcome
            onStartChat={() => setActiveConversation(null)}
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
