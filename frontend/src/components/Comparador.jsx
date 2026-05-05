import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  GitCompareArrows, ArrowLeft, Menu, X, Search, Plus,
  Loader2, AlertCircle, Hash, BookOpen, Sparkles, Lock
} from 'lucide-react';

const MAX_OBRAS = 4;
const MIN_OBRAS = 2;

const SUGERENCIAS = [
  { query: 'La existencia de Dios', obras: ['Summa Theologiae', 'Summa Contra Gentiles'] },
  { query: 'El alma humana', obras: ['Summa Theologiae', 'Quaestiones Disputatae De Anima'] },
  { query: 'La verdad', obras: ['Summa Theologiae', 'Quaestiones Disputatae De Veritate'] },
  { query: 'Los ángeles', obras: ['Summa Theologiae', 'De Substantiis Separatis'] },
];

export default function Comparador({ onBack, onToggleSidebar, sidebarOpen }) {
  const { profile, refreshProfile } = useAuth();
  const isPaid = profile?.plan !== 'gratuito';

  const [obrasDisponibles, setObrasDisponibles] = useState([]);
  const [loadingObras, setLoadingObras] = useState(true);

  const [query, setQuery] = useState('');
  const [obrasSeleccionadas, setObrasSeleccionadas] = useState([]);

  const [obraPickerOpen, setObraPickerOpen] = useState(false);
  const [obraPickerSearch, setObraPickerSearch] = useState('');
  const pickerRef = useRef(null);

  const [comparing, setComparing] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { loadObras(); }, []);

  // Cerrar picker al click fuera
  useEffect(() => {
    function onClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setObraPickerOpen(false);
      }
    }
    if (obraPickerOpen) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [obraPickerOpen]);

  async function loadObras() {
    try {
      setLoadingObras(true);
      const { obras } = await api.getObras();
      setObrasDisponibles(obras);
    } catch (e) { console.error(e); }
    finally { setLoadingObras(false); }
  }

  function addObra(obra) {
    if (obrasSeleccionadas.find(o => o.obra === obra.obra)) return;
    if (obrasSeleccionadas.length >= MAX_OBRAS) return;
    setObrasSeleccionadas([...obrasSeleccionadas, obra]);
    setObraPickerSearch('');
    setObraPickerOpen(false);
  }

  function removeObra(obraName) {
    setObrasSeleccionadas(obrasSeleccionadas.filter(o => o.obra !== obraName));
  }

  function loadSugerencia(sug) {
    setQuery(sug.query);
    const matched = sug.obras
      .map(name => obrasDisponibles.find(o => o.obra === name))
      .filter(Boolean);
    setObrasSeleccionadas(matched);
  }

  async function handleCompare(e) {
    e.preventDefault();
    setError('');
    if (!query.trim()) return setError('Escribí una consulta para comparar.');
    if (obrasSeleccionadas.length < MIN_OBRAS) {
      return setError(`Seleccioná al menos ${MIN_OBRAS} obras para comparar.`);
    }
    if (!isPaid) {
      return setError('El comparador requiere plan Studioso o Doctor.');
    }

    setComparing(true);
    setResultado(null);
    try {
      const obrasNames = obrasSeleccionadas.map(o => o.obra);
      const data = await api.compare(query.trim(), obrasNames);
      setResultado(data);
      refreshProfile();
    } catch (err) {
      if (err.status === 429) {
        setError('Sin créditos disponibles. Se resetean mañana o podés mejorar tu plan.');
      } else if (err.status === 403) {
        setError(err.error || 'Esta función requiere un plan superior.');
      } else {
        setError(err.error || 'Error al comparar.');
      }
    } finally {
      setComparing(false);
    }
  }

  const filteredObras = obrasDisponibles
    .filter(o => o.obra.toLowerCase().includes(obraPickerSearch.toLowerCase()))
    .filter(o => !obrasSeleccionadas.find(s => s.obra === o.obra))
    .slice(0, 50);

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
          <GitCompareArrows className="w-4 h-4 text-ultramarine-600" />
          <h1 className="text-base font-bold text-manuscrito-800">Comparador de Textos</h1>
        </div>
        {!isPaid && (
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-halo-100 text-halo-700 border border-halo-200 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Requiere Studioso
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto bg-ivory-50/50">
        <div className="max-w-6xl mx-auto px-5 py-6">

          {/* Hero / Setup */}
          <div className="bg-white border border-ivory-300 rounded-2xl p-6 shadow-sm mb-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-manuscrito-800 mb-1">
                Compará un tema en distintas obras
              </h2>
              <p className="text-sm text-manuscrito-400 leading-relaxed">
                Elegí entre {MIN_OBRAS} y {MAX_OBRAS} obras. Tu consulta se traduce al latín y se busca
                semánticamente en cada una. Vas a ver lado a lado cómo Tomás trata el mismo tema en
                cada texto.
              </p>
            </div>

            <form onSubmit={handleCompare} className="space-y-4">
              {/* Query */}
              <div>
                <label className="block text-xs font-bold text-manuscrito-600 mb-1.5 uppercase tracking-wide">
                  Tema a comparar
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej: la naturaleza del alma, el origen del mal, las virtudes teologales..."
                  className="w-full px-4 py-3 bg-white border border-ivory-300 rounded-lg
                             text-manuscrito-800 placeholder-manuscrito-300 text-base
                             focus:outline-none focus:border-ultramarine-400 focus:ring-2 focus:ring-ultramarine-100"
                />
              </div>

              {/* Obras seleccionadas */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-manuscrito-600 uppercase tracking-wide">
                    Obras a comparar
                  </label>
                  <span className="text-xs text-manuscrito-400">
                    {obrasSeleccionadas.length} / {MAX_OBRAS}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-2 min-h-[44px] p-2 bg-ivory-50 border border-ivory-300 rounded-lg">
                  {obrasSeleccionadas.length === 0 ? (
                    <span className="text-sm text-manuscrito-300 italic px-1 self-center">
                      Ninguna obra seleccionada
                    </span>
                  ) : (
                    obrasSeleccionadas.map(o => (
                      <span
                        key={o.obra}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-ultramarine-50
                                   border border-ultramarine-200 rounded-md text-sm text-ultramarine-800"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{o.obra}</span>
                        <button
                          type="button"
                          onClick={() => removeObra(o.obra)}
                          className="ml-1 p-0.5 rounded hover:bg-ultramarine-200/60"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Picker */}
                {obrasSeleccionadas.length < MAX_OBRAS && (
                  <div className="relative" ref={pickerRef}>
                    <button
                      type="button"
                      onClick={() => setObraPickerOpen(!obraPickerOpen)}
                      disabled={loadingObras}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md
                                 bg-white border border-dashed border-ivory-400
                                 text-manuscrito-600 hover:border-ultramarine-300 hover:bg-ultramarine-50/50
                                 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar obra
                    </button>

                    {obraPickerOpen && (
                      <div className="absolute z-10 mt-2 w-full sm:w-96 bg-white rounded-xl border border-ivory-300 shadow-lg overflow-hidden slide-up">
                        <div className="p-2 border-b border-ivory-200">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-manuscrito-300" />
                            <input
                              type="text"
                              autoFocus
                              value={obraPickerSearch}
                              onChange={(e) => setObraPickerSearch(e.target.value)}
                              placeholder="Buscar obra..."
                              className="w-full pl-9 pr-3 py-2 text-sm bg-ivory-50 border border-ivory-300 rounded-lg
                                         text-manuscrito-700 placeholder-manuscrito-300
                                         focus:outline-none focus:border-ultramarine-300"
                            />
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {filteredObras.length === 0 ? (
                            <div className="text-center py-6 text-sm text-manuscrito-400">
                              {obrasDisponibles.length === 0 ? 'Cargando...' : 'Sin resultados'}
                            </div>
                          ) : (
                            filteredObras.map(o => (
                              <button
                                key={o.obra}
                                type="button"
                                onClick={() => addObra(o)}
                                className="w-full text-left px-3 py-2 hover:bg-ultramarine-50 transition-colors flex items-start gap-2"
                              >
                                <BookOpen className="w-3.5 h-3.5 text-manuscrito-300 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-manuscrito-700 truncate">{o.obra}</div>
                                  <div className="text-[11px] text-manuscrito-400">{o.fragmentos} fragmentos</div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-manuscrito-400 italic">
                  Cada comparación consume 1 crédito de tu plan.
                </p>
                <button
                  type="submit"
                  disabled={comparing || !query.trim() || obrasSeleccionadas.length < MIN_OBRAS || !isPaid}
                  className="flex items-center gap-2 px-5 py-2.5 bg-ultramarine-600 hover:bg-ultramarine-500
                             text-white text-sm font-bold rounded-lg shadow-md shadow-ultramarine-600/15
                             disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {comparing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Comparando...
                    </>
                  ) : (
                    <>
                      <GitCompareArrows className="w-4 h-4" />
                      Comparar
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Sugerencias */}
            {!resultado && !comparing && (
              <div className="mt-5 pt-4 border-t border-ivory-200">
                <p className="text-xs text-manuscrito-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Sugerencias para empezar
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGERENCIAS.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => loadSugerencia(s)}
                      className="px-3 py-1.5 rounded-lg bg-ivory-50 border border-ivory-300
                                 text-xs text-manuscrito-600 hover:text-ultramarine-700
                                 hover:border-ultramarine-200 hover:bg-ultramarine-50/50
                                 transition-all"
                    >
                      {s.query}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-center gap-2 text-sm bg-fresco-50 border border-fresco-200 rounded-lg px-4 py-3 text-fresco-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading */}
          {comparing && !resultado && (
            <div className="bg-white border border-ivory-300 rounded-2xl p-12 text-center">
              <Loader2 className="w-8 h-8 text-ultramarine-400 animate-spin mx-auto mb-4" />
              <p className="text-manuscrito-600 italic">Quaerens in Corpore Thomistico...</p>
              <p className="text-xs text-manuscrito-400 mt-2">
                Traduciendo al latín y buscando en cada obra
              </p>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="space-y-5 fade-in">
              {/* Latín */}
              <div className="bg-halo-50/60 border border-halo-200 rounded-xl px-5 py-3">
                <div className="text-xs text-halo-700 mb-1 uppercase tracking-wide font-bold">
                  Búsqueda en latín
                </div>
                <p className="text-base italic text-halo-900 font-serif">
                  «{resultado.latin_query}»
                </p>
                <p className="text-xs text-halo-700 mt-1">
                  para tu consulta: <span className="font-bold">{resultado.query}</span>
                </p>
              </div>

              {/* Columnas comparadas */}
              <div className={`grid gap-4 ${
                resultado.comparison.length === 2 ? 'grid-cols-1 md:grid-cols-2'
                : resultado.comparison.length === 3 ? 'grid-cols-1 md:grid-cols-3'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
              }`}>
                {resultado.comparison.map(({ obra, fragmentos }) => (
                  <ComparisonColumn key={obra} obra={obra} fragmentos={fragmentos} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComparisonColumn({ obra, fragmentos }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="bg-white border border-ivory-300 rounded-xl overflow-hidden flex flex-col shadow-sm">
      <div className="px-4 py-3 bg-gradient-to-br from-ultramarine-50 to-halo-50 border-b border-ivory-200">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-ultramarine-600 shrink-0" />
          <h3 className="text-sm font-bold text-manuscrito-800 truncate">{obra}</h3>
        </div>
        <p className="text-[11px] text-manuscrito-400 mt-0.5">
          {fragmentos.length} fragmento{fragmentos.length !== 1 && 's'} más relevante{fragmentos.length !== 1 && 's'}
        </p>
      </div>

      <div className="flex-1 p-3 space-y-2.5">
        {fragmentos.length === 0 ? (
          <div className="text-center py-6 text-xs text-manuscrito-400">
            Sin coincidencias
          </div>
        ) : (
          fragmentos.map((f, i) => {
            const expanded = expandedId === f.id;
            const truncated = f.contenido.length > 280 && !expanded;
            return (
              <div
                key={f.id}
                className="p-3 rounded-lg bg-ivory-50/60 border border-ivory-200 hover:border-ultramarine-200 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-manuscrito-500 font-mono truncate">
                    <Hash className="w-3 h-3 shrink-0" />
                    <span className="truncate">{f.referencia}</span>
                  </div>
                  {f.similarity !== undefined && (
                    <span className="px-1.5 py-0.5 rounded bg-halo-100 text-halo-700 font-bold shrink-0">
                      {(f.similarity * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-manuscrito-700 leading-relaxed italic font-serif">
                  {truncated ? f.contenido.slice(0, 280) + '…' : f.contenido}
                </p>
                {f.contenido.length > 280 && (
                  <button
                    onClick={() => setExpandedId(expanded ? null : f.id)}
                    className="mt-2 text-[11px] text-ultramarine-600 hover:text-ultramarine-500 font-bold"
                  >
                    {expanded ? 'Ver menos' : 'Ver completo'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}