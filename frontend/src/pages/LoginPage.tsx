import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, APIError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { t, getLanguage, parseErrorMessage } from "../lib/i18n";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLanguage] = useState(getLanguage());

  useEffect(() => {
    const handleLanguageChange = () => {
      setLanguage(getLanguage());
    };
    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(username, password);
      login(result);
      navigate("/");
    } catch (err) {
      const errorMsg = err instanceof APIError ? err.message : "Unable to sign in";
      setError(parseErrorMessage(new Error(errorMsg)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <LanguageSwitcher className="language-switcher--floating" />
      <div className="login-panel">
        <p className="eyebrow">{t('auth.loginHeader')}</p>
        <h1>The Douchebags Open</h1>
        <p className="hero-subtitle">
          {t('auth.subtitle')}
        </p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} type="text" placeholder="Enter your username" />
          </label>
          <label>
            {t('auth.password')}
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button-primary" disabled={loading} type="submit">
            {loading ? "Signing in..." : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  );
}
