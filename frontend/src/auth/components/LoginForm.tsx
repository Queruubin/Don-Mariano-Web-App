import { isAxiosError } from 'axios';
import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo_letter.png';
import { apiErrorMessage } from '../../shared/utils/apiErrors';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const tokens = await authService.login({ email: email.trim(), password });
      setTokens(tokens);
      setUser(await authService.getMe());
      navigate('/');
    } catch (err: unknown) {
      logout();
      const status = isAxiosError(err) ? err.response?.status : undefined;
      setError(
        status === 401 || status === 400
          ? 'El correo o la contraseña no son correctos. Revíselos e intente de nuevo.'
          : apiErrorMessage(err),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-alt px-4 py-8">
      <div className="card w-full max-w-md p-6 shadow-sm sm:p-8 desk:max-w-sm desk:p-7">
        <img src={logo} alt="Tiendas Don Mariano" className="mx-auto mb-4 h-32 w-auto desk:mb-3 desk:h-24" />
        <h1 className="mb-1 text-center text-2xl">Domicilios</h1>
        <p className="mb-6 text-center text-text-muted desk:mb-5 desk:text-sm">Ingrese con su correo y contraseña</p>

        <form onSubmit={handleSubmit} className="space-y-5 desk:space-y-4">
          {error && (
            <p role="alert" className="rounded-2xl bg-danger-soft p-3 font-semibold text-danger desk:rounded-xl desk:text-sm">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="email" className="field-label">
              Correo
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
              placeholder="nombre@donmariano.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn btn-primary w-full text-lg desk:text-base">
            <LogIn aria-hidden="true" className="size-5 desk:size-4" />
            {isLoading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
