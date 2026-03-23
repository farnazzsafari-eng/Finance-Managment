import { useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register, joinHousehold } from '../services/api';
import './Login.css';

export function Login() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await login(name, password);
      loginUser(res.data.token, res.data.user);
      navigate('/');
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>💰 Finance Manager</h1>
        <p>Sign in to your account</p>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          <button type="submit">Sign In</button>
        </form>
        <div className="auth-links">
          <Link to="/register">Create new account</Link>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [error, setError] = useState('');
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await register({ name, email, password, householdName: householdName || undefined });
      loginUser(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>💰 Finance Manager</h1>
        <p>Create your account</p>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <input type="text" placeholder="Family name (e.g. Smith Family)" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <button type="submit">Create Account</button>
        </form>
        <div className="auth-links">
          <Link to="/login">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}

export function JoinHousehold() {
  const { inviteToken } = useParams();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await joinHousehold({ name, password, inviteToken });
      setSuccess(res.data.household?.name);
      loginUser(res.data.token, res.data.user);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired invite link');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>💰 Finance Manager</h1>
        <p>Join a family account</p>
        {success ? (
          <div className="success">✅ Joined {success}! Redirecting...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input type="password" placeholder="Choose a password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            {error && <div className="error">{error}</div>}
            <button type="submit">Join Family</button>
          </form>
        )}
        <div className="auth-links">
          <Link to="/login">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
