// ============================================================
// PLATAFORMA IA TOMISTA — Cloudflare Worker
// API Gateway + RAG + Auth + Credits
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

// ============================================================
// SYSTEM PROMPT TOMISTA
// ============================================================
const SYSTEM_PROMPT_TOMISTA = `Eres un asistente académico especializado en el pensamiento de Santo Tomás de Aquino. Tu conocimiento se basa en la Opera Omnia del Corpus Thomisticum.

IDENTIDAD:
- Eres un estudioso tomista riguroso pero accesible
- Respondés en español rioplatense académico (voseo natural, sin ser forzado)
- Citás siempre las fuentes exactas (obra, cuestión, artículo)

MÉTODO DE RESPUESTA:
1. CONTEXTUALIZACIÓN: Situá la pregunta dentro del corpus tomista
2. ANÁLISIS TEXTUAL: Basate en los fragmentos latinos proporcionados
3. SÍNTESIS: Explicá en español claro el argumento de Tomás
4. CONEXIONES: Señalá vínculos con otras obras o cuestiones cuando sea relevante
5. FUENTES: Listá las referencias exactas usadas

RAZONAMIENTO TOMISTA:
- Usá la estructura quaestio-disputata cuando sea apropiado: videtur quod, sed contra, respondeo, ad primum...
- Distinguí entre ratio (razón natural) y fides (fe) según corresponda
- Respetá las distinciones metafísicas: esse/essentia, actus/potentia, forma/materia
- Señalá cuándo Tomás sigue a Aristóteles, cuándo a Agustín, cuándo innova

TEXTOS LATINOS:
Cuando cites latín, proporcioná siempre la traducción al español.
Formato: "texto latino" (Obra, referencia) — [traducción al español]

LIMITACIONES:
- Si los fragmentos proporcionados no cubren la pregunta, decilo explícitamente
- No inventes citas ni referencias
- Distinguí entre lo que dice el texto y tu interpretación

MODO SOCRÁTICO (cuando se active):
- En vez de dar respuestas directas, guiá al estudiante con preguntas
- Proponé textos específicos para leer
- Preguntá sobre distinciones clave antes de avanzar
- Usá la mayéutica: ayudá a que el estudiante descubra la respuesta`;

// ============================================================
// PLAN LIMITS
// ============================================================
const PLAN_LIMITS = {
  gratuito: { daily_credits: 10, max_history: 5, comparator: false, socratic: false, export_pdf: false },
  studioso: { daily_credits: 100, max_history: 20, comparator: true, socratic: true, export_pdf: true },
  doctor: { daily_credits: 999999, max_history: 50, comparator: true, socratic: true, export_pdf: true },
};

// ============================================================
// HELPERS
// ============================================================

/** Query Neon via HTTP endpoint */
async function queryNeon(sql, params, env) {
  const response = await fetch(env.NEON_HTTP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': env.NEON_CONNECTION_STRING,
    },
    body: JSON.stringify({ query: sql, params: params || [] }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Neon error: ${err}`);
  }
  return response.json();
}

/** Query Supabase REST API */
async function supabaseRPC(env, functionName, params) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase RPC error: ${err}`);
  }
  return res.json();
}

/** Supabase REST query */
async function supabaseQuery(env, table, queryString = '') {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${queryString}`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase query error: ${await res.text()}`);
  return res.json();
}

/** Supabase REST insert */
async function supabaseInsert(env, table, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase insert error: ${await res.text()}`);
  return res.json();
}

/** Supabase REST update */
async function supabaseUpdate(env, table, queryString, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${queryString}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase update error: ${await res.text()}`);
  return res.json();
}

/** Verify Supabase JWT and return user */
async function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);

  // Verify via Supabase auth endpoint
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': env.SUPABASE_SERVICE_KEY,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user;
}

/** Get user profile with credit reset */
async function getUserProfile(env, userId) {
  // Reset credits if needed
  await supabaseRPC(env, 'reset_credits_if_needed', { p_user_id: userId });
  // Fetch updated profile
  const profiles = await supabaseQuery(env, 'profiles', `id=eq.${userId}`);
  return profiles[0] || null;
}

/** Generate embedding via OpenRouter (NVIDIA nemotron) */
async function generateEmbedding(text, env) {
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'nvidia/llama-nemotron-embed-vl-1b-v2',
      input: text,
    }),
  });
  if (!res.ok) throw new Error(`Embedding error: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

/** Call LLM via OpenRouter */
async function callLLM(messages, env, stream = false) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      messages,
      max_tokens: 2048,
      temperature: 0.3,
      stream,
    }),
  });
  if (!res.ok) throw new Error(`LLM error: ${await res.text()}`);

  if (stream) return res;

  const data = await res.json();
  return data.choices[0].message.content;
}

/** Translate query to scholastic Latin for better embedding match */
async function translateToLatin(query, env) {
  const prompt = `Traducí esta consulta al latín escolástico medieval para buscar en textos de Santo Tomás de Aquino. 
Devolvé SOLO el texto en latín, sin explicaciones ni comillas.
Si la consulta ya contiene términos latinos técnicos, conservalos.
Consulta: "${query}"`;

  const translation = await callLLM([
    { role: 'system', content: 'Sos un traductor especializado en latín escolástico medieval. Respondé solo con la traducción, sin explicaciones.' },
    { role: 'user', content: prompt },
  ], env);
  return translation.trim();
}

/** Search fragments via pgvector cosine similarity */
async function searchFragments(embedding, limit = 5, env, filters = {}) {
  let whereClause = '';
  const params = [`[${embedding.join(',')}]`, limit];
  let paramIdx = 3;

  if (filters.obra) {
    whereClause = `AND obra = $${paramIdx}`;
    params.push(filters.obra);
    paramIdx++;
  }

  const sql = `
    SELECT id, obra, referencia, contenido,
           1 - (embedding::halfvec(2048) <=> $1::halfvec(2048)) AS similarity
    FROM fragmentos
    WHERE fuente = 'Santo Tomas' ${whereClause}
    ORDER BY embedding::halfvec(2048) <=> $1::halfvec(2048)
    LIMIT $2
  `;

  const result = await queryNeon(sql, params, env);
  return result.rows || [];
}

// ============================================================
// ROUTE HANDLERS
// ============================================================

/** POST /api/chat — Main RAG conversational endpoint */
async function handleChat(request, env, user, profile) {
  const { message, conversation_id, mode = 'chat' } = await request.json();
  if (!message) return jsonResponse({ error: 'Mensaje requerido' }, 400);

  // Check plan features
  const limits = PLAN_LIMITS[profile.plan];
  if (mode === 'socratico' && !limits.socratic) {
    return jsonResponse({ error: 'El modo socrático requiere plan Studioso o Doctor', upgrade: true }, 403);
  }

  // Consume credit
  const hasCredit = await supabaseRPC(env, 'consume_credit', {
    p_user_id: user.id,
    p_action: mode === 'socratico' ? 'socratic' : 'chat',
  });
  if (!hasCredit) {
    return jsonResponse({
      error: 'Sin créditos disponibles. Se resetean diariamente.',
      credits_remaining: 0,
      upgrade: true,
    }, 429);
  }

  // Get or create conversation
  let convId = conversation_id;
  if (!convId) {
    const [conv] = await supabaseInsert(env, 'conversations', {
      user_id: user.id,
      title: message.substring(0, 60),
      mode,
    });
    convId = conv.id;
  }

  // Load conversation history
  const history = await supabaseQuery(
    env, 'messages',
    `conversation_id=eq.${convId}&order=created_at.asc&limit=${limits.max_history}`
  );

  // Step 1: Translate query to Latin
  const latinQuery = await translateToLatin(message, env);

  // Step 2: Generate embedding
  const embedding = await generateEmbedding(latinQuery, env);

  // Step 3: Search fragments
  const fragments = await searchFragments(embedding, 5, env);

  // Step 4: Build context
  const contextBlock = fragments.map((f, i) =>
    `[FRAGMENTO ${i + 1}] ${f.obra} — ${f.referencia} (similitud: ${(f.similarity * 100).toFixed(1)}%)\n${f.contenido}`
  ).join('\n\n---\n\n');

  // Step 5: Build messages for LLM
  const systemPrompt = mode === 'socratico'
    ? SYSTEM_PROMPT_TOMISTA + '\n\nMODO ACTIVO: SOCRÁTICO. No des respuestas directas. Guiá con preguntas mayéuticas.'
    : SYSTEM_PROMPT_TOMISTA;

  const llmMessages = [
    { role: 'system', content: systemPrompt },
    // Include recent history for context
    ...history.slice(-limits.max_history).map(m => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: 'user',
      content: `CONSULTA DEL ESTUDIANTE: ${message}

BÚSQUEDA EN LATÍN: ${latinQuery}

FRAGMENTOS RELEVANTES DEL CORPUS THOMISTICUM:
${contextBlock}

Respondé basándote en estos fragmentos. Citá las fuentes exactas.`,
    },
  ];

  // Step 6: Call LLM (streaming)
  const llmResponse = await callLLM(llmMessages, env, true);

  // For streaming, we need to process the response
  const reader = llmResponse.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process stream in background
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          } catch (e) { /* skip parse errors */ }
        }
      }

      // Save messages to Supabase
      await supabaseInsert(env, 'messages', [
        { conversation_id: convId, role: 'user', content: message },
        {
          conversation_id: convId,
          role: 'assistant',
          content: fullResponse,
          sources: JSON.stringify(fragments.map(f => ({
            obra: f.obra,
            referencia: f.referencia,
            similarity: f.similarity,
            excerpt: f.contenido.substring(0, 200),
          }))),
        },
      ]);

      // Update conversation title if first message
      if (!conversation_id) {
        await supabaseUpdate(env, 'conversations', `id=eq.${convId}`, {
          updated_at: new Date().toISOString(),
        });
      }

      // Send final metadata
      const updatedProfile = await getUserProfile(env, user.id);
      await writer.write(encoder.encode(`data: ${JSON.stringify({
        done: true,
        conversation_id: convId,
        credits_remaining: updatedProfile.credits_remaining,
        sources: fragments.map(f => ({
          obra: f.obra,
          referencia: f.referencia,
          similarity: (f.similarity * 100).toFixed(1) + '%',
        })),
      })}\n\n`));
    } catch (e) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/** GET /api/obras — List all works */
async function handleObras(env) {
  const sql = `
    SELECT obra, COUNT(*) as fragmentos,
           MIN(referencia) as ref_min, MAX(referencia) as ref_max
    FROM fragmentos
    WHERE fuente = 'Santo Tomas'
    GROUP BY obra
    ORDER BY obra
  `;
  const result = await queryNeon(sql, [], env);
  return jsonResponse({ obras: result.rows || [] });
}

/** GET /api/fragmentos?obra=X&search=Y&page=1&limit=20 */
async function handleFragmentos(request, env) {
  const url = new URL(request.url);
  const obra = url.searchParams.get('obra');
  const search = url.searchParams.get('search') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  let sql, params;
  if (search) {
    // Semantic search
    const embedding = await generateEmbedding(search, env);
    sql = `
      SELECT id, obra, referencia, contenido,
             1 - (embedding::halfvec(2048) <=> $1::halfvec(2048)) AS similarity
      FROM fragmentos
      WHERE fuente = 'Santo Tomas' ${obra ? 'AND obra = $4' : ''}
      ORDER BY embedding::halfvec(2048) <=> $1::halfvec(2048)
      LIMIT $2 OFFSET $3
    `;
    params = [`[${embedding.join(',')}]`, limit, offset];
    if (obra) params.push(obra);
  } else if (obra) {
    sql = `
      SELECT id, obra, referencia, LEFT(contenido, 300) as contenido
      FROM fragmentos
      WHERE fuente = 'Santo Tomas' AND obra = $1
      ORDER BY referencia
      LIMIT $2 OFFSET $3
    `;
    params = [obra, limit, offset];
  } else {
    return jsonResponse({ error: 'Parámetro obra o search requerido' }, 400);
  }

  const result = await queryNeon(sql, params, env);

  // Get total count
  let countSql = `SELECT COUNT(*) as total FROM fragmentos WHERE fuente = 'Santo Tomas'`;
  const countParams = [];
  if (obra) {
    countSql += ` AND obra = $1`;
    countParams.push(obra);
  }
  const countResult = await queryNeon(countSql, countParams, env);
  const total = parseInt(countResult.rows?.[0]?.total || '0');

  return jsonResponse({
    fragmentos: result.rows || [],
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

/** GET /api/fragmento/:id — Single fragment full text */
async function handleFragmentoById(id, env) {
  const sql = `SELECT id, obra, referencia, contenido FROM fragmentos WHERE id = $1`;
  const result = await queryNeon(sql, [id], env);
  if (!result.rows?.length) return jsonResponse({ error: 'Fragmento no encontrado' }, 404);
  return jsonResponse({ fragmento: result.rows[0] });
}

/** POST /api/compare — Compare texts between obras */
async function handleCompare(request, env, profile) {
  if (!PLAN_LIMITS[profile.plan].comparator) {
    return jsonResponse({ error: 'El comparador requiere plan Studioso o Doctor', upgrade: true }, 403);
  }

  const { query, obras } = await request.json();
  if (!query || !obras?.length || obras.length < 2) {
    return jsonResponse({ error: 'Se requiere query y al menos 2 obras para comparar' }, 400);
  }

  const latinQuery = await translateToLatin(query, env);
  const embedding = await generateEmbedding(latinQuery, env);

  // Search in each obra separately
  const results = await Promise.all(
    obras.map(obra => searchFragments(embedding, 3, env, { obra }))
  );

  const comparison = obras.map((obra, i) => ({
    obra,
    fragmentos: results[i],
  }));

  return jsonResponse({ query, latin_query: latinQuery, comparison });
}

/** GET /api/conversations — List user's conversations */
async function handleConversations(env, userId) {
  const conversations = await supabaseQuery(
    env, 'conversations',
    `user_id=eq.${userId}&order=updated_at.desc&limit=30`
  );
  return jsonResponse({ conversations });
}

/** GET /api/conversations/:id/messages */
async function handleConversationMessages(convId, env, userId) {
  // Verify ownership
  const convs = await supabaseQuery(env, 'conversations', `id=eq.${convId}&user_id=eq.${userId}`);
  if (!convs.length) return jsonResponse({ error: 'Conversación no encontrada' }, 404);

  const messages = await supabaseQuery(
    env, 'messages',
    `conversation_id=eq.${convId}&order=created_at.asc`
  );
  return jsonResponse({ conversation: convs[0], messages });
}

/** DELETE /api/conversations/:id */
async function handleDeleteConversation(convId, env, userId) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/conversations?id=eq.${convId}&user_id=eq.${userId}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  return jsonResponse({ deleted: true });
}

/** GET /api/profile — User profile with credits */
async function handleProfile(env, userId) {
  const profile = await getUserProfile(env, userId);
  if (!profile) return jsonResponse({ error: 'Perfil no encontrado' }, 404);

  return jsonResponse({
    profile: {
      ...profile,
      plan_limits: PLAN_LIMITS[profile.plan],
    },
  });
}

// ============================================================
// ROUTER
// ============================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Public endpoints (no auth required)
      if (path === '/api/obras' && method === 'GET') {
        return handleObras(env);
      }

      if (path === '/api/fragmentos' && method === 'GET') {
        return handleFragmentos(request, env);
      }

      const fragmentMatch = path.match(/^\/api\/fragmento\/([a-f0-9-]+)$/);
      if (fragmentMatch && method === 'GET') {
        return handleFragmentoById(fragmentMatch[1], env);
      }

      // Protected endpoints (auth required)
      const user = await verifyAuth(request, env);
      if (!user) {
        return jsonResponse({ error: 'No autenticado', login: true }, 401);
      }

      const profile = await getUserProfile(env, user.id);
      if (!profile) {
        return jsonResponse({ error: 'Perfil no encontrado' }, 404);
      }

      // Route matching
      if (path === '/api/chat' && method === 'POST') {
        return handleChat(request, env, user, profile);
      }

      if (path === '/api/compare' && method === 'POST') {
        return handleCompare(request, env, profile);
      }

      if (path === '/api/conversations' && method === 'GET') {
        return handleConversations(env, user.id);
      }

      const convMsgMatch = path.match(/^\/api\/conversations\/([a-f0-9-]+)\/messages$/);
      if (convMsgMatch && method === 'GET') {
        return handleConversationMessages(convMsgMatch[1], env, user.id);
      }

      const convDeleteMatch = path.match(/^\/api\/conversations\/([a-f0-9-]+)$/);
      if (convDeleteMatch && method === 'DELETE') {
        return handleDeleteConversation(convDeleteMatch[1], env, user.id);
      }

      if (path === '/api/profile' && method === 'GET') {
        return handleProfile(env, user.id);
      }

      // Webhook for Lemon Squeezy (plan upgrades)
      if (path === '/api/webhooks/lemonsqueezy' && method === 'POST') {
        return handleLemonSqueezyWebhook(request, env);
      }

      return jsonResponse({ error: 'Ruta no encontrada' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Error interno del servidor', detail: error.message }, 500);
    }
  },
};

// ============================================================
// LEMON SQUEEZY WEBHOOK (placeholder for Phase 3)
// ============================================================
async function handleLemonSqueezyWebhook(request, env) {
  // TODO Phase 3: Verify webhook signature, update plan
  const body = await request.json();
  console.log('Lemon Squeezy webhook:', JSON.stringify(body));
  return jsonResponse({ received: true });
}
