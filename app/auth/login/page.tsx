'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setLoading(true); setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) { setError('Invalid email or password'); setLoading(false); }
    else router.push('/dashboard');
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#080C10', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"JetBrains Mono", monospace', color: '#E2E8F0',
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#00FF88', marginBottom: 8 }}>SIMIOTX</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC' }}>Welcome back</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com" type="email"
            style={inputStyle} />
          <input value={password} onChange={e => setPassword(e.target.value)}
            placeholder="password" type="password"
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

          {error && <div style={{ color: '#FF4444', fontSize: 12 }}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading}
            style={{
              background: loading ? '#1a2a1a' : '#00FF88',
              color: '#080C10', border: 'none',
              padding: '14px', fontSize: 13, fontWeight: 800,
              letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}>
            {loading ? 'SIGNING IN...' : 'SIGN IN →'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#475569' }}>
          No account?{' '}
          <Link href="/auth/register" style={{ color: '#00FF88', textDecoration: 'none' }}>
            Register free
          </Link>
        </div>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
    </div>
  );
}

const inputStyle: any = {
  background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)',
  color: '#E2E8F0', padding: '12px 16px', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', width: '100%',
};
