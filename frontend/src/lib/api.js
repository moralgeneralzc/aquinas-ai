import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'https://tomista-api.TU-USUARIO.workers.dev';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiFetch(path, options = {}) {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de red' }));
    throw { status: res.status, ...err };
  }
  return res.json();
}

export const api = {
  // Profile
  getProfile: () => apiFetch('/api/profile'),

  // Conversations
  getConversations: () => apiFetch('/api/conversations'),
  getConversationMessages: (id) => apiFetch(`/api/conversations/${id}/messages`),
  deleteConversation: (id) => apiFetch(`/api/conversations/${id}`, { method: 'DELETE' }),

  // Chat (streaming)
  async *chatStream(message, conversationId = null, mode = 'chat') {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ message, conversation_id: conversationId, mode }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error de red' }));
      throw { status: res.status, ...err };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          yield data;
        } catch (e) { /* skip */ }
      }
    }
  },

  // Browse
  getObras: () => apiFetch('/api/obras'),
  getFragmentos: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/fragmentos?${qs}`);
  },
  getFragmento: (id) => apiFetch(`/api/fragmento/${id}`),

  // Compare
  compare: (query, obras) =>
    apiFetch('/api/compare', {
      method: 'POST',
      body: JSON.stringify({ query, obras }),
    }),
};
