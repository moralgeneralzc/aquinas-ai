import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, LogIn, UserPlus, AlertCircle } from 'lucide-react';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (isRegister) {
        await signUp(email, password, displayName);
        setSuccess('¡Cuenta creada! Revisá tu email para confirmar el registro.');
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory-100 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ultramarine-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-halo-100/40 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ultramarine-50 border border-ultramarine-200 mb-5 shadow-sm">
            <BookOpen className="w-8 h-8 text-ultramarine-600" />
          </div>
          <h1 className="text-3xl font-bold text-manuscrito-900 mb-2">
            Aquinas AI
          </h1>
          <p className="text-halo-700 italic text-lg">
            Veritas est adaequatio rei et intellectus
          </p>
          <p className="text-manuscrito-400 text-sm mt-1">
            Plataforma de estudio tomista con inteligencia artificial
          </p>
        </div>

        {/* Form */}
        <div className="glass-panel p-8">
          <h2 className="text-xl font-bold text-manuscrito-800 mb-6">
            {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm text-manuscrito-500 mb-1.5">Nombre</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre" className="input-field" required={isRegister} />
              </div>
            )}
            <div>
              <label className="block text-sm text-manuscrito-500 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com" className="input-field" required />
            </div>
            <div>
              <label className="block text-sm text-manuscrito-500 mb-1.5">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="input-field" required minLength={6} />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-fresco-700 bg-fresco-50 border border-fresco-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {success}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isRegister ? (
                <><UserPlus className="w-4 h-4" /> Registrarse</>
              ) : (
                <><LogIn className="w-4 h-4" /> Ingresar</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}
              className="text-sm text-manuscrito-400 hover:text-ultramarine-600 transition-colors">
              {isRegister ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Registrate gratis'}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          {[
            { label: '30.529', desc: 'fragmentos' },
            { label: 'Opera Omnia', desc: 'completa' },
            { label: 'IA Tomista', desc: 'especializada' },
          ].map(({ label, desc }) => (
            <div key={label} className="p-3 rounded-lg bg-white/60 border border-ivory-300/60">
              <div className="text-sm font-bold text-ultramarine-600">{label}</div>
              <div className="text-xs text-manuscrito-400">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
