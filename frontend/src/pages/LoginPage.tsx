import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, APIError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.login(email, password);
      login(result);
      navigate("/");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-panel">
        <p className="eyebrow">Local tournament control</p>
        <h1>The Douchebags Open</h1>
        <p className="hero-subtitle">
          Mobile-first scoring, live standings, secret side games, and a proper event-day control room.
        </p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button-primary" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Enter the clubhouse"}
          </button>
        </form>
      </div>
    </div>
  );
}
