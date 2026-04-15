# Aquinas AI — Guía de Deploy Fase 1

## Arquitectura

```
Frontend (CF Pages)  →  Worker (CF Workers)  →  Neon PostgreSQL (fragmentos + embeddings)
     ↕                       ↕                        
  Supabase Auth         OpenRouter (embeddings NVIDIA + LLM Haiku)
  Supabase DB           Supabase (profiles, credits, conversations)
```

## Paso 1: Configurar Supabase

1. Ir a [supabase.com](https://supabase.com) → Nuevo proyecto
2. En **SQL Editor**, ejecutar `supabase/migration.sql` completo
3. En **Authentication → Settings**:
   - Habilitar Email/Password
   - Configurar Site URL: `https://tu-dominio.pages.dev`
   - Agregar Redirect URLs: `https://tu-dominio.pages.dev/**`
4. Anotar:
   - `Project URL` → SUPABASE_URL
   - `anon public key` → VITE_SUPABASE_ANON_KEY
   - `service_role key` → SUPABASE_SERVICE_KEY (secreto, solo para el Worker)

## Paso 2: Deploy del Worker

```bash
cd worker

# Configurar secrets (uno por uno, te pide el valor)
npx wrangler secret put NEON_CONNECTION_STRING
# Pegar: postgresql://neondb_owner:npg_CDZzU7S0aPje@ep-hidden-mode-anw2shmo.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require

npx wrangler secret put NEON_HTTP_ENDPOINT
# Pegar: https://ep-hidden-mode-anw2shmo.c-6.us-east-1.aws.neon.tech/sql

npx wrangler secret put OPENROUTER_API_KEY
# Pegar: tu API key de OpenRouter

npx wrangler secret put SUPABASE_URL
# Pegar: https://TU-PROYECTO.supabase.co

npx wrangler secret put SUPABASE_SERVICE_KEY
# Pegar: tu service_role key de Supabase

# Deploy
npx wrangler deploy
```

Anotar la URL del Worker (ej: `https://tomista-api.tu-usuario.workers.dev`)

## Paso 3: Deploy del Frontend

```bash
cd frontend

# Crear .env con tus valores
cp .env.example .env
# Editar .env con los valores reales

# Instalar dependencias
npm install

# Test local
npm run dev

# Build para producción
npm run build

# Deploy a Cloudflare Pages
npx wrangler pages deploy dist --project-name=aquinas-ai
```

O configurar GitHub auto-deploy:
1. Subir a GitHub
2. Cloudflare Dashboard → Pages → Create → Connect to Git
3. Build command: `npm run build`
4. Build output: `dist`
5. Variables de entorno: agregar VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

## Paso 4: CORS del Worker

Si usás un dominio custom, actualizar `CORS_HEADERS` en el Worker:

```js
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://aquinas-ai.pages.dev',  // tu dominio
  // ...
};
```

## Paso 5: Verificar

1. Abrir el frontend → Registrarse
2. Verificar en Supabase que se creó el profile con plan 'gratuito' y 10 créditos
3. Hacer una pregunta → verificar streaming y fuentes
4. Verificar que los créditos decrementan

## Estructura de archivos

```
plataforma-tomista/
├── supabase/
│   └── migration.sql          # Schema completo (ejecutar en SQL Editor)
├── worker/
│   ├── wrangler.toml           # Config del Worker
│   └── src/
│       └── index.js            # API Gateway + RAG + Auth + Credits
├── frontend/
│   ├── .env.example            # Variables de entorno
│   ├── index.html              # Entry HTML con Google Fonts
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js      # Paleta tomista custom
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── index.css           # Tailwind + custom styles
│       ├── App.jsx             # Router principal
│       ├── lib/
│       │   ├── supabase.js     # Cliente Supabase
│       │   └── api.js          # Cliente API (Worker)
│       ├── contexts/
│       │   └── AuthContext.jsx  # Auth + profile state
│       └── components/
│           ├── Login.jsx        # Login/Register
│           ├── Sidebar.jsx      # Conversaciones + créditos
│           ├── Chat.jsx         # Chat con streaming + fuentes
│           └── Welcome.jsx      # Pantalla de bienvenida
└── DEPLOY.md                   # Esta guía
```

## Modelo de Monetización

| Feature              | Gratis (10/día) | Studioso $5/mes (100/día) | Doctor $12/mes (∞) |
|----------------------|:---------------:|:-------------------------:|:-------------------:|
| Chat IA              | ✅ 10           | ✅ 100                    | ✅ Ilimitado        |
| Navegador de obras   | ✅              | ✅                        | ✅                  |
| Modo socrático       | ❌              | ✅                        | ✅                  |
| Comparador           | ❌              | ✅                        | ✅                  |
| Export PDF            | ❌              | ✅                        | ✅                  |
| Historial msgs       | 5 últimos       | 20 últimos                | 50 últimos          |
| Acceso API           | ❌              | ❌                        | ✅                  |

## Costos operativos estimados

- **Cloudflare Workers**: Free tier = 100k requests/día → $0
- **Cloudflare Pages**: Free tier → $0
- **Supabase**: Free tier (500MB, 50k auth) → $0
- **Neon PostgreSQL**: Free tier (512MB) → $0
- **OpenRouter**: Embeddings NVIDIA gratis, Haiku ~$0.25/1M tokens input
- **Total base**: ~$0/mes. A escala con usuarios pagos, el costo LLM se cubre solo.

## Próximas Fases

- **Fase 2**: Navegador de obras + Comparador de textos
- **Fase 3**: Lemon Squeezy payments + Modo socrático completo
- **Fase 4**: Landing page + Dashboard de uso + Export PDF
