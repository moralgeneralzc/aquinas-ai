import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import {
  Library, Search, ChevronLeft, ChevronRight, X, Loader2,
  BookOpen, FileText, Menu, ArrowLeft, Sparkles, Hash
} from 'lucide-react';

export default function Browser({ onBack, onToggleSidebar, sidebarOpen }) {
  const [obras, setObras] = useState([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [obraSearch, setObraSearch] = useState('');

  const [selectedObra, setSelectedObra] = useState(null);
  const [fragmentos, setFragmentos] = useState([]);
  const [loadingFragmentos, setLoadingFragmentos] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [selectedFragmento, setSelectedFragmento] = useState(null);

  const [obrasPanelOpen, setObrasPanelOpen] = useState(true);
  const fragRef = useRef(null);

  useEffect(() => { loadObras(); }, []);

  useEffect(() => {
    if (selectedObra) loadFragmentos();
  }, [selectedObra, page, appliedSearch]);

  async function loadObras() {
    try {
      setLoadingObras(true);
      const { obras: list } = await api.getObras();
      setObras(list);
    } catch (e) { console.error('Error cargando obras:', e); }
    finally { setLoadingObras(false); }
  }

  async function loadFragmentos() {
    try {
      setLoadingFragmentos(true);
      const params = { obra: selectedObra.obra, page, limit: 20 };
      if (appliedSearch) params.search = appliedSearch;
      const data = await api.getFragmentos(params);
      setFragmentos(data.fragmentos);
      setPagination(data.pagination);
      fragRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { console.error('Error cargando fragmentos:', e); }
    finally { setLoadingFragmentos(false); }
  }

  async function openFragmento(id) {
    try {
      setSelectedFragmento({ id, loading: true });
      const { fragmento } = await api.getFragmento(id);
      setSelectedFragmento(fragmento);
    } catch (e) { console.error(e); setSelectedFragmento(null); }
  }

  function applySearch(e) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
  }

  function selectNewObra(obra) {
    setSelectedObra(obra);
    setPage(1);
    setSearchInput('');
    setAppliedSearch('');
    if (window.innerWidth < 768) setObrasPanelOpen(false);
  }

  const filteredObras = obras.filter(o =>
    o.obra.toLowerCase().includes(obraSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 px-5 py-3 border-b border-ivory-200 bg-white/60 backdrop-blur-sm flex items-center gap-3">
        {!sidebarOpen && (
          <button onClick={onToggleSidebar} className="p-1.5 rounded-md hover:bg-ivory-200 text-manuscrito-400">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-manuscrito-500 hover:text-manuscrito-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>
        <div className="h-5 w-px bg-ivory-300" />
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-ultramarine-600" />
          <h1 className="text-base font-bold text-manuscrito-800">Navegador de Obras</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-manuscrito-400 hidden sm:inline">
            {obras.length} obras · 30.529 fragmentos
          </span>
          <button
            onClick={() => setObrasPanelOpen(!obrasPanelOpen)}
            className="md:hidden p-1.5 rounded-md hover:bg-ivory-200 text-manuscrito-400"
            title="Toggle lista de obras"
          >
            <Library className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 bg-ivory-50/50">
        {/* Panel obras */}
        <aside className={`${obrasPanelOpen ? 'w-80' : 'w-0'} shrink-0 border-r border-ivory-200 bg-white/60 transition-all duration-300 overflow-hidden flex flex-col`}>
          <div className="p-3 border-b border-ivory-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-manuscrito-300" />
              <input
                type="text"
                value={obraSearch}
                onChange={(e) => setObraSearch(e.target.value)}
                placeholder="Filtrar obras..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-ivory-50 border border-ivory-300 rounded-lg
                           text-manuscrito-700 placeholder-manuscrito-300
                           focus:outline-none focus:border-ultramarine-300 focus:ring-2 focus:ring-ultramarine-100"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loadingObras ? (
              <div className="text-center py-12">
                <Loader2 className="w-6 h-6 text-manuscrito-300 animate-spin mx-auto" />
              </div>
            ) : filteredObras.length === 0 ? (
              <div className="text-center py-8 px-4 text-sm text-manuscrito-400">
                Sin resultados
              </div>
            ) : (
              filteredObras.map(o => (
                <button
                  key={o.obra}
                  onClick={() => selectNewObra(o)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all
                    ${selectedObra?.obra === o.obra
                      ? 'bg-ultramarine-50 border border-ultramarine-200/60 text-manuscrito-800'
                      : 'hover:bg-ivory-200/60 text-manuscrito-600 border border-transparent'
                    }`}
                >
                  <div className="flex items-start gap-2">
                    <BookOpen className={`w-4 h-4 shrink-0 mt-0.5 ${
                      selectedObra?.obra === o.obra ? 'text-ultramarine-600' : 'text-manuscrito-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{o.obra}</div>
                      <div className="text-[11px] text-manuscrito-400 mt-0.5">
                        {o.fragmentos} fragmentos
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Panel fragmentos */}
        <main className="flex-1 flex flex-col min-w-0">
          {!selectedObra ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center max-w-md fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                                bg-gradient-to-br from-ultramarine-100 to-halo-100
                                border border-ultramarine-200/60 mb-5">
                  <Library className="w-8 h-8 text-ultramarine-600" />
                </div>
                <h2 className="text-xl font-bold text-manuscrito-800 mb-2">Opera Omnia</h2>
                <p className="text-sm text-manuscrito-400 leading-relaxed">
                  Elegí una obra del panel izquierdo para empezar a navegar.
                  Podés buscar dentro de cada obra de manera semántica
                  (sin gastar créditos para este modo).
                </p>
                <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-halo-700 italic">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>«In omnibus requiem quaesivi» — Eccli. 24, 11</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Header de la obra */}
              <div className="shrink-0 px-5 py-4 border-b border-ivory-200 bg-white/40">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-manuscrito-800 truncate">
                      {selectedObra.obra}
                    </h2>
                    <p className="text-xs text-manuscrito-400 mt-0.5">
                      {selectedObra.fragmentos} fragmentos
                      {pagination && ` · página ${pagination.page} de ${pagination.pages}`}
                    </p>
                  </div>
                </div>
                <form onSubmit={applySearch} className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-manuscrito-300" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Búsqueda semántica dentro de esta obra..."
                      className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-ivory-300 rounded-lg
                                 text-manuscrito-700 placeholder-manuscrito-300
                                 focus:outline-none focus:border-ultramarine-300 focus:ring-2 focus:ring-ultramarine-100"
                    />
                    {appliedSearch && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-ivory-200 text-manuscrito-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!searchInput.trim() || loadingFragmentos}
                    className="px-4 py-2 bg-ultramarine-600 hover:bg-ultramarine-500 text-white text-sm font-bold
                               rounded-lg shadow-sm shadow-ultramarine-600/20
                               disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Buscar
                  </button>
                </form>
                {appliedSearch && (
                  <p className="mt-2 text-xs text-halo-700 italic">
                    Mostrando resultados ordenados por similitud semántica con: <span className="font-bold not-italic">«{appliedSearch}»</span>
                  </p>
                )}
              </div>

              {/* Fragmentos */}
              <div ref={fragRef} className="flex-1 overflow-y-auto px-5 py-4">
                {loadingFragmentos ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-6 h-6 text-manuscrito-300 animate-spin mx-auto" />
                  </div>
                ) : fragmentos.length === 0 ? (
                  <div className="text-center py-12 text-sm text-manuscrito-400">
                    Sin fragmentos
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-3">
                    {fragmentos.map((f, i) => (
                      <button
                        key={f.id}
                        onClick={() => openFragmento(f.id)}
                        className="w-full text-left p-4 rounded-xl bg-white border border-ivory-300
                                   hover:border-ultramarine-300 hover:shadow-md transition-all
                                   group shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 text-xs">
                            <Hash className="w-3.5 h-3.5 text-manuscrito-300" />
                            <span className="font-mono text-manuscrito-600">{f.referencia}</span>
                            {f.similarity !== undefined && f.similarity !== null && (
                              <span className="px-1.5 py-0.5 rounded bg-halo-100 text-halo-700 text-[10px] font-bold">
                                {(f.similarity * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <FileText className="w-4 h-4 text-manuscrito-300 group-hover:text-ultramarine-500 transition-colors" />
                        </div>
                        <p className="text-sm text-manuscrito-700 leading-relaxed line-clamp-3 italic">
                          {f.contenido}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Paginación */}
              {pagination && pagination.pages > 1 && !appliedSearch && (
                <div className="shrink-0 px-5 py-3 border-t border-ivory-200 bg-white/40 flex items-center justify-between">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loadingFragmentos}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md
                               text-manuscrito-600 hover:bg-ivory-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <span className="text-sm text-manuscrito-500">
                    {pagination.page} / {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages || loadingFragmentos}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md
                               text-manuscrito-600 hover:bg-ivory-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de fragmento */}
      {selectedFragmento && (
        <FragmentoModal
          fragmento={selectedFragmento}
          onClose={() => setSelectedFragmento(null)}
        />
      )}
    </div>
  );
}

function FragmentoModal({ fragmento, onClose }) {
  useEffect(() => {
    function onEsc(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-manuscrito-900/40 backdrop-blur-sm flex items-center justify-center p-4 fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-ivory-300 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 py-4 border-b border-ivory-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-manuscrito-800 truncate">
              {fragmento.obra || 'Cargando...'}
            </h3>
            {fragmento.referencia && (
              <p className="text-xs text-manuscrito-400 mt-0.5 font-mono">{fragmento.referencia}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-ivory-200 text-manuscrito-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {fragmento.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-manuscrito-300 animate-spin" />
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <p className="text-manuscrito-800 leading-relaxed italic whitespace-pre-wrap font-serif">
                {fragmento.contenido}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-3 border-t border-ivory-200 flex items-center justify-between bg-ivory-50/50 rounded-b-2xl">
          <span className="text-xs text-halo-700 italic">
            Corpus Thomisticum
          </span>
          <button
            onClick={onClose}
            className="text-sm text-manuscrito-500 hover:text-manuscrito-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}