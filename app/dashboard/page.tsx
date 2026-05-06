'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const DEMO_LOGS = [
  '{“deviceId”:“esp32-001”,“heartRate”:87,“spo2”:97,“temperature”:37.1}',
  '{“deviceId”:“esp32-001”,“heartRate”:89,“spo2”:96,“temperature”:37.2}',
  '{“deviceId”:“weather-01”,“temperature”:28.4,“humidity”:71,“pressure”:1013}',
  '{“deviceId”:“esp32-001”,“heartRate”:91,“spo2”:95,“temperature”:37.3}',
  '{“deviceId”:“gps-03”,“latitude”:6.524,“longitude”:3.379,“speed”:0}',
  '{“deviceId”:“esp32-001”,“heartRate”:88,“spo2”:97,“temperature”:37.1}',
];

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setLogs(prev => [...prev.slice(-6), DEMO_LOGS[idx % DEMO_LOGS.length]]);
      setIdx(i => i + 1);
    }, 1800);
    return () => clearInterval(t);
  }, [idx]);

  return (
    <div style={{ minHeight: '100vh', background: '#080C10', fontFamily: '“JetBrains Mono”,“Fira Code”,monospace', color: '#E2E8F0', overflowX: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundImage: `linear-gradient(rgba(0,255,136,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.03) 1px,transparent 1px)`, backgroundSize: '40px 40px' }} />
      {/* NAV */}
      <nav style={{ position: 'relative', zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(0,255,136,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 12px #00FF88' }} />
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, color: '#00FF88' }}>SIMIOTX</span>
        </div>

        {/* Desktop nav */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }} className="desktop-nav">
          <Link href="#pricing" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 12, letterSpacing: 1 }}>PRICING</Link>
          <Link href="/auth/login" style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 12, letterSpacing: 1 }}>LOGIN</Link>
          <Link href="/auth/register" style={{ background: 'transparent', border: '1px solid #00FF88', color: '#00FF88', padding: '8px 16px', fontSize: 12, letterSpacing: 1, textDecoration: 'none' }}>GET STARTED →</Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMenuOpen(m => !m)} style={{ display: 'none', background: 'transparent', border: '1px solid rgba(0,255,136,0.3)', color: '#00FF88', padding: '6px 10px', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }} className="mobile-menu-btn">
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{ position: 'relative', zIndex: 99, background: '#0D1117', borderBottom: '1px solid rgba(0,255,136,0.1)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link href="#pricing" onClick={() => setMenuOpen(false)} style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 13, letterSpacing: 1 }}>PRICING</Link>
          <Link href="/auth/login" onClick={() => setMenuOpen(false)} style={{ color: '#94A3B8', textDecoration: 'none', fontSize: 13, letterSpacing: 1 }}>LOGIN</Link>
          <Link href="/auth/register" onClick={() => setMenuOpen(false)} style={{ background: '#00FF88', color: '#080C10', padding: '12px 16px', fontSize: 13, letterSpacing: 1, textDecoration: 'none', fontWeight: 800, textAlign: 'center' as const }}>GET STARTED →</Link>
        </div>
      )}

      {/* HERO */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: '60px 20px 40px' }}>
        <div style={{ display: 'inline-block', border: '1px solid rgba(0,255,136,0.3)', padding: '4px 12px', fontSize: 10, letterSpacing: 2, color: '#00FF88', marginBottom: 24 }}>
          IoT DEVICE SIMULATOR — CLOUD BASED
        </div>
        <h1 style={{ fontSize: 'clamp(32px,8vw,72px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, marginBottom: 20, color: '#F8FAFC' }}>
          Test your IoT pipeline<br />
          <span style={{ color: '#00FF88' }}>without hardware.</span>
        </h1>
        <p style={{ fontSize: 'clamp(14px,3vw,18px)', color: '#94A3B8', lineHeight: 1.7, maxWidth: 520, marginBottom: 36 }}>
          Virtual ESP32 simulators that send realistic sensor data to your MQTT broker or HTTP endpoint. No physical device needed.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/auth/register" style={{ background: '#00FF88', color: '#080C10', padding: '14px 28px', fontWeight: 800, fontSize: 13, letterSpacing: 2, textDecoration: 'none' }}>START FREE →</Link>
          <Link href="#how" style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#94A3B8', padding: '14px 28px', fontSize: 13, letterSpacing: 1, textDecoration: 'none' }}>HOW IT WORKS</Link>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 'clamp(20px,5vw,48px)', marginTop: 48, paddingTop: 36, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          {[['60s', 'Setup'], ['MQTT+HTTP', 'Protocols'], ['10+', 'Sensors'], ['Free', 'To start']].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontSize: 'clamp(20px,4vw,28px)', fontWeight: 800, color: '#00FF88' }}>{v}</div>
              <div style={{ fontSize: 11, color: '#64748B', letterSpacing: 1, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TERMINAL */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: '0 20px 60px' }}>
        <div style={{ background: '#0D1117', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: '#161B22', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(0,255,136,0.1)', flexWrap: 'wrap' }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
            <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8, letterSpacing: 1 }}>LIVE SIMULATOR OUTPUT</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 8px #00FF88' }} />
              <span style={{ fontSize: 10, color: '#00FF88' }}>LIVE</span>
            </div>
          </div>
          <div style={{ padding: '16px', minHeight: 180, fontFamily: 'monospace', fontSize: 'clamp(9px,2vw,12px)' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: 1 - (logs.length - 1 - i) * 0.1 }}>
                <span style={{ color: '#00FF88' }}>→ </span>
                <span style={{ color: '#94A3B8', wordBreak: 'break-all' as const }}>{log}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <span style={{ color: '#00FF88' }}>$</span>
              <div style={{ width: 7, height: 14, background: '#00FF88', animation: 'blink 1s infinite' }} />
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: '#00FF88', marginBottom: 12 }}>HOW IT WORKS</div>
        <h2 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 800, marginBottom: 40, color: '#F8FAFC' }}>From zero to streaming in 3 steps</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24 }}>
          {[
            { step: '01', title: 'Connect your broker', desc: 'Paste your MQTT broker URL or HTTP endpoint. Supports HiveMQ, AWS IoT, any broker.' },
            { step: '02', title: 'Configure sensors', desc: 'Choose from presets (medical, weather, GPS) or build custom sensors with any range.' },
            { step: '03', title: 'Start simulating', desc: 'Hit start. Your virtual device sends realistic drifting sensor data every few seconds.' },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ border: '1px solid rgba(255,255,255,0.08)', padding: 24, position: 'relative' }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: 'rgba(0,255,136,0.08)', position: 'absolute', top: 12, right: 20 }}>{step}</div>
              <div style={{ fontSize: 10, color: '#00FF88', letterSpacing: 2, marginBottom: 10 }}>STEP {step}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 10 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: '#00FF88', marginBottom: 12 }}>PRICING</div>
        <h2 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 800, marginBottom: 40, color: '#F8FAFC' }}>Pay with crypto. No card needed.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
          {[
            { plan: 'FREE', price: '$0', period: 'forever', features: ['1 virtual device', '100 messages/day', 'MQTT + HTTP', 'Community support'], cta: 'Start free', hi: false },
            { plan: 'PRO', price: '$10', period: '/month in crypto', features: ['Unlimited devices', 'Unlimited messages', 'All sensor presets', 'Priority support', 'API access'], cta: 'Upgrade with crypto', hi: true },
            { plan: 'TEAM', price: '$29', period: '/month in crypto', features: ['Everything in Pro', 'Team members', 'Custom sensors', 'Webhooks', 'SLA'], cta: 'Upgrade with crypto', hi: false },
          ].map(({ plan, price, period, features, cta, hi }) => (
            <div key={plan} style={{ border: `1px solid ${hi ? '#00FF88' : 'rgba(255,255,255,0.08)'}`, padding: 24, position: 'relative', background: hi ? 'rgba(0,255,136,0.03)' : 'transparent' }}>
              {hi && <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: '#00FF88', color: '#080C10', fontSize: 9, fontWeight: 800, padding: '2px 10px', letterSpacing: 2 }}>POPULAR</div>}
              <div style={{ fontSize: 11, letterSpacing: 3, color: hi ? '#00FF88' : '#64748B', marginBottom: 12 }}>{plan}</div>
              <div style={{ fontSize: 'clamp(28px,6vw,40px)', fontWeight: 900, color: '#F8FAFC', marginBottom: 2 }}>{price}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 24 }}>{period}</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 24 }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#94A3B8' }}>
                    <span style={{ color: '#00FF88' }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link href="/auth/register" style={{ display: 'block', textAlign: 'center' as const, background: hi ? '#00FF88' : 'transparent', border: `1px solid ${hi ? '#00FF88' : 'rgba(255,255,255,0.15)'}`, color: hi ? '#080C10' : '#94A3B8', padding: '12px', fontSize: 12, letterSpacing: 1, textDecoration: 'none', fontWeight: hi ? 800 : 400 }}>{cta}</Link>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 20px', textAlign: 'center' as const, color: '#334155', fontSize: 11, letterSpacing: 1, position: 'relative', zIndex: 10 }}>
        SIMIOTX © 2025 — VIRTUAL IoT DEVICE SIMULATOR
      </div>

      <style>{`
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
*{box-sizing:border-box;margin:0;padding:0}
@media(max-width:640px){
.desktop-nav{display:none!important}
.mobile-menu-btn{display:block!important}
}
`}</style>
    </div>
  );
}