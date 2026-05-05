'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SENSOR_PRESETS, SCENARIO_PRESETS } from '@/lib/simulator';

type Device = {
  _id: string; deviceId: string; name: string; protocol: string;
  brokerUrl: string; topic: string; interval: number;
  isRunning: boolean; msgCount: number; sensors: any[]; lastSent?: string;
};
type Log = { _id: string; timestamp: string; payload: any; status: string; error?: string };
type Webhook = { _id: string; sensorName: string; operator: string; value: number; webhookUrl: string; triggerCount: number };

const S: any = {
  layout: { display:'flex', minHeight:'100vh', background:'#080C10', fontFamily:'"JetBrains Mono",monospace', color:'#E2E8F0' },
  sidebar: { width:220, borderRight:'1px solid rgba(255,255,255,0.06)', padding:'24px 0', display:'flex', flexDirection:'column' },
  main: { flex:1, padding:32, overflowY:'auto' as const },
  card: { background:'#0D1117', border:'1px solid rgba(255,255,255,0.08)', padding:24, marginBottom:16 },
  btn: (on?:boolean) => ({ background:on?'#00FF88':'transparent', border:`1px solid ${on?'#00FF88':'rgba(255,255,255,0.12)'}`, color:on?'#080C10':'#94A3B8', padding:'8px 18px', fontSize:11, letterSpacing:2, cursor:'pointer', fontFamily:'inherit', fontWeight:on?800:400 }),
  inp: { background:'#080C10', border:'1px solid rgba(255,255,255,0.1)', color:'#E2E8F0', padding:'10px 14px', fontSize:12, fontFamily:'inherit', outline:'none', width:'100%' },
  lbl: { fontSize:10, letterSpacing:2, color:'#475569', marginBottom:6, display:'block' },
  danger: { background:'transparent', border:'1px solid rgba(255,68,68,0.4)', color:'#FF4444', padding:'6px 14px', fontSize:11, letterSpacing:2, cursor:'pointer', fontFamily:'inherit' },
};

const VIEWS = ['devices','new','scenarios','webhooks'] as const;

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Device|null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [view, setView] = useState<typeof VIEWS[number]>('devices');
  const [chaosMap, setChaosMap] = useState<Record<string,boolean>>({});
  const [shareUrl, setShareUrl] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<any[]>([]);

  // New device form
  const [nd, setNd] = useState({ name:'', protocol:'mqtt', brokerUrl:'', username:'', password:'', topic:'', interval:2000, preset:'medical' });
  // New webhook form
  const [nw, setNw] = useState({ sensorName:'', operator:'gt', value:0, webhookUrl:'', method:'POST' });
  // Scenario builder
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioPreset, setScenarioPreset] = useState('Patient Deterioration');
  const [scenarioLoop, setScenarioLoop] = useState(false);

  useEffect(() => { if (status==='unauthenticated') router.push('/auth/login'); }, [status]);

  const loadDevices = useCallback(async () => {
    const r = await fetch('/api/devices'); const d = await r.json();
    if (d.success) setDevices(d.data);
  }, []);

  const loadLogs = useCallback(async (deviceId: string) => {
    const r = await fetch(`/api/devices/${deviceId}/logs`); const d = await r.json();
    if (d.success) setLogs(d.data);
  }, []);

  const loadWebhooks = useCallback(async (deviceId: string) => {
    const r = await fetch(`/api/webhooks/threshold?deviceId=${deviceId}`); const d = await r.json();
    if (d.success) setWebhooks(d.data);
  }, []);

  useEffect(() => { if (status==='authenticated') loadDevices(); }, [status]);

  useEffect(() => {
    if (!selected) return;
    loadLogs(selected.deviceId);
    loadWebhooks(selected.deviceId);
    const t = setInterval(() => loadLogs(selected.deviceId), 3000);
    return () => clearInterval(t);
  }, [selected]);

  const toggle = async (device: Device) => {
    const action = device.isRunning ? 'stop' : 'start';
    await fetch(`/api/simulator/${device.deviceId}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action, chaosMode: chaosMap[device.deviceId], csvRows: csvRows.length ? csvRows : undefined }),
    });
    await loadDevices();
  };

  const createDevice = async () => {
    const sensors = (SENSOR_PRESETS as any)[nd.preset] || SENSOR_PRESETS.medical;
    const r = await fetch('/api/devices', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...nd, sensors}) });
    const d = await r.json();
    if (d.success) { await loadDevices(); setView('devices'); }
    else alert(d.error);
  };

  const createWebhook = async () => {
    if (!selected) return;
    const r = await fetch('/api/webhooks/threshold', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...nw, deviceId: selected.deviceId}) });
    const d = await r.json();
    if (d.success) { await loadWebhooks(selected.deviceId); setNw({ sensorName:'', operator:'gt', value:0, webhookUrl:'', method:'POST' }); }
  };

  const deleteWebhook = async (id: string) => {
    await fetch(`/api/webhooks/threshold?id=${id}`, { method:'DELETE' });
    if (selected) loadWebhooks(selected.deviceId);
  };

  const saveScenario = async () => {
    if (!selected || !scenarioName) return;
    const steps = (SCENARIO_PRESETS as any)[scenarioPreset];
    await fetch('/api/scenarios', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:scenarioName, deviceId:selected.deviceId, steps, loop:scenarioLoop }) });
    alert('Scenario saved! Start the device to run it.');
  };

  const generateShare = async (deviceId: string) => {
    const r = await fetch('/api/share', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ deviceId }) });
    const d = await r.json();
    if (d.success) { setShareUrl(d.data.shareUrl); }
  };

  const handleCSV = async (e: any) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/devices/csv', { method:'POST', body:fd });
    const d = await r.json();
    if (d.success) { setCsvRows(d.data.rows); alert(`CSV loaded: ${d.data.rowCount} rows, columns: ${d.data.columns.join(', ')}`); }
  };

  // Start ALL devices at once (multi-device orchestration)
  const startAll = async () => {
    await Promise.all(devices.filter(d=>!d.isRunning).map(d=>
      fetch(`/api/simulator/${d.deviceId}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'start'}) })
    ));
    await loadDevices();
  };
  const stopAll = async () => {
    await Promise.all(devices.filter(d=>d.isRunning).map(d=>
      fetch(`/api/simulator/${d.deviceId}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'stop'}) })
    ));
    await loadDevices();
  };

  if (status==='loading') return <div style={{...S.layout,alignItems:'center',justifyContent:'center'}}><span style={{color:'#00FF88'}}>LOADING...</span></div>;

  const runningCount = devices.filter(d=>d.isRunning).length;

  return (
    <div style={S.layout}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:4px;background:#080C10} ::-webkit-scrollbar-thumb{background:#1a2a1a} select,option{background:#080C10;color:#E2E8F0}`}</style>

      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={{padding:'0 20px 24px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 8px #00FF88'}}/>
            <span style={{fontSize:14,fontWeight:800,color:'#00FF88',letterSpacing:2}}>SIMIOTX</span>
          </div>
          <div style={{fontSize:10,color:'#334155',marginTop:4}}>{session?.user?.email}</div>
        </div>

        <div style={{padding:'16px 12px',flex:1}}>
          {[['devices','📡 DEVICES'],['new','+ NEW DEVICE'],['scenarios','🎬 SCENARIOS'],['webhooks','🔔 WEBHOOKS']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setView(id as any)} style={{display:'block',width:'100%',textAlign:'left' as const,background:view===id?'rgba(0,255,136,0.08)':'transparent',border:'none',borderLeft:`2px solid ${view===id?'#00FF88':'transparent'}`,color:view===id?'#00FF88':'#475569',padding:'10px 14px',fontSize:11,letterSpacing:2,cursor:'pointer',fontFamily:'inherit',marginBottom:4}}>{lbl}</button>
          ))}
        </div>

        <div style={{padding:'16px 20px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
          {runningCount > 0 && <div style={{fontSize:10,color:'#00FF88',marginBottom:8}}>● {runningCount} RUNNING</div>}
          <div style={{fontSize:10,color:'#334155',marginBottom:8}}>PLAN: <span style={{color:'#00FF88'}}>{((session?.user as any)?.plan||'FREE').toUpperCase()}</span></div>
          <button onClick={()=>signOut({callbackUrl:'/'})} style={{...S.btn(),fontSize:10,width:'100%',textAlign:'center' as const}}>SIGN OUT</button>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>

        {/* ── DEVICES VIEW ── */}
        {view==='devices' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <div>
                <div style={{fontSize:11,color:'#00FF88',letterSpacing:3,marginBottom:4}}>VIRTUAL DEVICES</div>
                <div style={{fontSize:22,fontWeight:800,color:'#F8FAFC'}}>{devices.length} device{devices.length!==1?'s':''}</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                {devices.length>1 && <>
                  <button onClick={startAll} style={S.btn(true)}>▶ START ALL</button>
                  <button onClick={stopAll} style={S.btn()}>⏹ STOP ALL</button>
                </>}
                <button onClick={()=>setView('new')} style={S.btn()}>+ NEW</button>
              </div>
            </div>

            {devices.length===0 && (
              <div style={{...S.card,textAlign:'center',padding:48}}>
                <div style={{fontSize:32,marginBottom:12}}>📡</div>
                <div style={{color:'#475569',fontSize:13,marginBottom:16}}>No devices yet.</div>
                <button onClick={()=>setView('new')} style={S.btn(true)}>CREATE DEVICE →</button>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:selected?'1fr 1fr':'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
              <div>
                {devices.map(device=>(
                  <div key={device._id} onClick={()=>setSelected(s=>s?.deviceId===device.deviceId?null:device)}
                    style={{...S.card,cursor:'pointer',marginBottom:12,borderColor:selected?.deviceId===device.deviceId?'#00FF88':'rgba(255,255,255,0.08)',borderLeft:`3px solid ${device.isRunning?'#00FF88':'#334155'}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:'#F8FAFC',marginBottom:2}}>{device.name}</div>
                        <div style={{fontSize:10,color:'#475569'}}>{device.deviceId.slice(0,16)}...</div>
                      </div>
                      <div style={{fontSize:9,letterSpacing:2,fontWeight:800,color:device.isRunning?'#080C10':'#475569',background:device.isRunning?'#00FF88':'transparent',border:`1px solid ${device.isRunning?'#00FF88':'#334155'}`,padding:'3px 8px'}}>{device.isRunning?'LIVE':'STOPPED'}</div>
                    </div>

                    <div style={{display:'flex',gap:12,marginBottom:12,fontSize:11,color:'#475569'}}>
                      <span>{device.protocol.toUpperCase()}</span>
                      <span>{device.interval/1000}s</span>
                      <span>{device.msgCount} msgs</span>
                    </div>

                    {/* Chaos toggle */}
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                      <button onClick={e=>{e.stopPropagation();setChaosMap(m=>({...m,[device.deviceId]:!m[device.deviceId]}))}}
                        style={{...S.btn(chaosMap[device.deviceId]),fontSize:10,padding:'5px 12px'}}>
                        ⚡ CHAOS {chaosMap[device.deviceId]?'ON':'OFF'}
                      </button>
                      <button onClick={e=>{e.stopPropagation();csvRef.current?.click()}}
                        style={{...S.btn(csvRows.length>0),fontSize:10,padding:'5px 12px'}}>
                        📂 CSV {csvRows.length>0?`(${csvRows.length})`:'REPLAY'}
                      </button>
                    </div>

                    <div style={{display:'flex',gap:8}}>
                      <button onClick={e=>{e.stopPropagation();toggle(device)}} style={S.btn(device.isRunning)}>
                        {device.isRunning?'⏹ STOP':'▶ START'}
                      </button>
                      <button onClick={e=>{e.stopPropagation();generateShare(device.deviceId)}} style={{...S.btn(),fontSize:10}}>
                        🔗 SHARE
                      </button>
                    </div>

                    {shareUrl && selected?.deviceId===device.deviceId && (
                      <div style={{marginTop:10,padding:8,background:'rgba(0,255,136,0.05)',border:'1px solid rgba(0,255,136,0.2)',fontSize:10,color:'#00FF88',wordBreak:'break-all' as const}}>
                        {shareUrl}
                        <button onClick={()=>{navigator.clipboard.writeText(shareUrl)}} style={{...S.btn(true),marginLeft:8,fontSize:9,padding:'2px 8px'}}>COPY</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Log panel */}
              {selected && (
                <div style={S.card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <div style={{fontSize:11,letterSpacing:2,color:'#00FF88'}}>LOGS — {selected.name}</div>
                    {selected.isRunning && <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:6,height:6,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 8px #00FF88'}}/><span style={{fontSize:10,color:'#00FF88'}}>LIVE</span></div>}
                  </div>
                  <div style={{maxHeight:450,overflowY:'auto' as const,fontSize:11}}>
                    {logs.length===0?<div style={{color:'#334155',textAlign:'center',padding:32}}>Start simulator to see logs</div>:
                    logs.map((log,i)=>(
                      <div key={log._id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',opacity:1-i*0.04}}>
                        <div style={{color:'#475569',marginBottom:2,fontSize:10}}>
                          {new Date(log.timestamp).toLocaleTimeString()} <span style={{color:log.status==='sent'?'#00FF88':'#FF4444'}}>[{log.status.toUpperCase()}]</span>
                        </div>
                        <div style={{color:'#94A3B8',wordBreak:'break-all' as const,fontSize:10}}>{JSON.stringify(log.payload)}</div>
                        {log.error&&<div style={{color:'#FF4444',fontSize:10}}>{log.error}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}}/>
          </>
        )}

        {/* ── NEW DEVICE VIEW ── */}
        {view==='new' && (
          <>
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,color:'#00FF88',letterSpacing:3,marginBottom:4}}>NEW DEVICE</div>
              <div style={{fontSize:22,fontWeight:800,color:'#F8FAFC'}}>Configure virtual device</div>
            </div>
            <div style={{maxWidth:600}}>
              <div style={S.card}>
                <div style={{fontSize:11,letterSpacing:2,color:'#00FF88',marginBottom:20}}>BASIC INFO</div>
                <div style={{marginBottom:16}}><label style={S.lbl}>DEVICE NAME</label><input value={nd.name} onChange={e=>setNd(d=>({...d,name:e.target.value}))} placeholder="e.g. Hospital Bed 1" style={S.inp}/></div>
                <div style={{marginBottom:16}}>
                  <label style={S.lbl}>PROTOCOL</label>
                  <div style={{display:'flex',gap:8}}>
                    {['mqtt','http'].map(p=><button key={p} onClick={()=>setNd(d=>({...d,protocol:p}))} style={S.btn(nd.protocol===p)}>{p.toUpperCase()}</button>)}
                  </div>
                </div>
                <div style={{marginBottom:16}}><label style={S.lbl}>{nd.protocol==='mqtt'?'BROKER URL':'HTTP ENDPOINT'}</label><input value={nd.brokerUrl} onChange={e=>setNd(d=>({...d,brokerUrl:e.target.value}))} placeholder={nd.protocol==='mqtt'?'mqtts://xxx.hivemq.cloud:8883':'https://your-api.com/data'} style={S.inp}/></div>
                {nd.protocol==='mqtt'&&<>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                    <div><label style={S.lbl}>USERNAME</label><input value={nd.username} onChange={e=>setNd(d=>({...d,username:e.target.value}))} style={S.inp}/></div>
                    <div><label style={S.lbl}>PASSWORD</label><input type="password" value={nd.password} onChange={e=>setNd(d=>({...d,password:e.target.value}))} style={S.inp}/></div>
                  </div>
                  <div style={{marginBottom:16}}><label style={S.lbl}>TOPIC</label><input value={nd.topic} onChange={e=>setNd(d=>({...d,topic:e.target.value}))} placeholder="e.g. hospital/patient/P001/vitals" style={S.inp}/></div>
                </>}
                <div style={{marginBottom:0}}>
                  <label style={S.lbl}>INTERVAL</label>
                  <div style={{display:'flex',gap:8}}>
                    {[1000,2000,5000,10000].map(ms=><button key={ms} onClick={()=>setNd(d=>({...d,interval:ms}))} style={S.btn(nd.interval===ms)}>{ms/1000}s</button>)}
                  </div>
                </div>
              </div>

              <div style={S.card}>
                <div style={{fontSize:11,letterSpacing:2,color:'#00FF88',marginBottom:16}}>SENSOR PRESET</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                  {Object.keys(SENSOR_PRESETS).map(p=>(
                    <button key={p} onClick={()=>setNd(d=>({...d,preset:p}))} style={{...S.btn(nd.preset===p),textAlign:'left' as const,padding:'12px 16px'}}>
                      <div style={{textTransform:'uppercase' as const,letterSpacing:2,fontSize:11}}>{p}</div>
                      <div style={{fontSize:10,color:nd.preset===p?'#080C10':'#334155',marginTop:4}}>{(SENSOR_PRESETS as any)[p].length} sensors</div>
                    </button>
                  ))}
                </div>
                <div style={{fontSize:11,color:'#475569'}}>Sensors: {(SENSOR_PRESETS as any)[nd.preset]?.map((s:any)=>s.name).join(', ')}</div>
              </div>

              <div style={{display:'flex',gap:12}}>
                <button onClick={createDevice} disabled={!nd.name||!nd.brokerUrl} style={{...S.btn(true),flex:1,padding:'14px',opacity:(!nd.name||!nd.brokerUrl)?0.4:1}}>CREATE DEVICE →</button>
                <button onClick={()=>setView('devices')} style={S.btn()}>CANCEL</button>
              </div>
            </div>
          </>
        )}

        {/* ── SCENARIOS VIEW ── */}
        {view==='scenarios' && (
          <>
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,color:'#00FF88',letterSpacing:3,marginBottom:4}}>SCENARIO SCRIPTING</div>
              <div style={{fontSize:22,fontWeight:800,color:'#F8FAFC'}}>Script sensor behaviour over time</div>
              <div style={{fontSize:13,color:'#475569',marginTop:8}}>Define sequences of target values — the simulator gradually moves sensors toward each target.</div>
            </div>

            {!selected&&<div style={{...S.card,textAlign:'center',padding:32,color:'#475569',fontSize:13}}>← Select a device from Devices to attach a scenario</div>}

            {selected && (
              <div style={{maxWidth:600}}>
                <div style={S.card}>
                  <div style={{fontSize:11,letterSpacing:2,color:'#00FF88',marginBottom:16}}>CREATE SCENARIO FOR: {selected.name}</div>
                  <div style={{marginBottom:16}}><label style={S.lbl}>SCENARIO NAME</label><input value={scenarioName} onChange={e=>setScenarioName(e.target.value)} placeholder="e.g. Patient Deterioration Test" style={S.inp}/></div>
                  <div style={{marginBottom:16}}>
                    <label style={S.lbl}>PRESET SCRIPT</label>
                    <select value={scenarioPreset} onChange={e=>setScenarioPreset(e.target.value)} style={{...S.inp,appearance:'none' as const}}>
                      {Object.keys(SCENARIO_PRESETS).map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Preview steps */}
                  <div style={{marginBottom:16}}>
                    <label style={S.lbl}>STEPS PREVIEW</label>
                    {(SCENARIO_PRESETS as any)[scenarioPreset]?.map((step:any,i:number)=>(
                      <div key={i} style={{display:'flex',gap:12,padding:'8px 12px',background:i%2===0?'rgba(255,255,255,0.02)':'transparent',marginBottom:4,fontSize:11}}>
                        <span style={{color:'#00FF88',minWidth:20}}>{i+1}.</span>
                        <span style={{color:'#F8FAFC',flex:1}}>{step.label}</span>
                        <span style={{color:'#475569'}}>{step.durationSeconds}s</span>
                        <span style={{color:'#94A3B8',fontSize:10}}>{Object.entries(step.targetValues||{}).map(([k,v])=>`${k}:${v}`).join(' ')}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                    <button onClick={()=>setScenarioLoop(l=>!l)} style={S.btn(scenarioLoop)}>🔁 LOOP</button>
                    <span style={{fontSize:11,color:'#475569'}}>{scenarioLoop?'Will repeat indefinitely':'Stops at last step'}</span>
                  </div>

                  <button onClick={saveScenario} disabled={!scenarioName} style={{...S.btn(true),width:'100%',padding:'12px',opacity:!scenarioName?0.4:1}}>SAVE SCENARIO →</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── WEBHOOKS VIEW ── */}
        {view==='webhooks' && (
          <>
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,color:'#00FF88',letterSpacing:3,marginBottom:4}}>THRESHOLD WEBHOOKS</div>
              <div style={{fontSize:22,fontWeight:800,color:'#F8FAFC'}}>Trigger HTTP calls when values cross thresholds</div>
              <div style={{fontSize:13,color:'#475569',marginTop:8}}>Test your alert systems end-to-end — when the simulator crosses a threshold, it hits your webhook.</div>
            </div>

            {!selected&&<div style={{...S.card,textAlign:'center',padding:32,color:'#475569',fontSize:13}}>← Select a device from Devices first</div>}

            {selected && (
              <div style={{maxWidth:700}}>
                <div style={S.card}>
                  <div style={{fontSize:11,letterSpacing:2,color:'#00FF88',marginBottom:16}}>ADD WEBHOOK FOR: {selected.name}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    <div>
                      <label style={S.lbl}>SENSOR NAME</label>
                      <input value={nw.sensorName} onChange={e=>setNw(w=>({...w,sensorName:e.target.value}))} placeholder="e.g. heartRate" style={S.inp}/>
                    </div>
                    <div>
                      <label style={S.lbl}>CONDITION</label>
                      <select value={nw.operator} onChange={e=>setNw(w=>({...w,operator:e.target.value}))} style={{...S.inp,appearance:'none' as const}}>
                        {[['gt','>'],['lt','<'],['gte','>='],['lte','<='],['eq','=']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:12}}>
                    <div><label style={S.lbl}>THRESHOLD VALUE</label><input type="number" value={nw.value} onChange={e=>setNw(w=>({...w,value:+e.target.value}))} style={S.inp}/></div>
                    <div><label style={S.lbl}>WEBHOOK URL</label><input value={nw.webhookUrl} onChange={e=>setNw(w=>({...w,webhookUrl:e.target.value}))} placeholder="https://your-api.com/alert" style={S.inp}/></div>
                  </div>
                  <div style={{display:'flex',gap:8,marginBottom:16}}>
                    {['POST','GET'].map(m=><button key={m} onClick={()=>setNw(w=>({...w,method:m}))} style={S.btn(nw.method===m)}>{m}</button>)}
                  </div>
                  <button onClick={createWebhook} disabled={!nw.sensorName||!nw.webhookUrl} style={{...S.btn(true),opacity:(!nw.sensorName||!nw.webhookUrl)?0.4:1}}>ADD WEBHOOK →</button>
                </div>

                {webhooks.length>0 && (
                  <div style={S.card}>
                    <div style={{fontSize:11,letterSpacing:2,color:'#00FF88',marginBottom:16}}>ACTIVE WEBHOOKS</div>
                    {webhooks.map(wh=>(
                      <div key={wh._id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',fontSize:12}}>
                        <div>
                          <span style={{color:'#F8FAFC'}}>{wh.sensorName}</span>
                          <span style={{color:'#475569',margin:'0 8px'}}>{wh.operator}</span>
                          <span style={{color:'#00FF88'}}>{wh.value}</span>
                          <span style={{color:'#475569',fontSize:10,marginLeft:12}}>→ {wh.webhookUrl.slice(0,40)}...</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                          <span style={{fontSize:10,color:'#475569'}}>fired: {wh.triggerCount}x</span>
                          <button onClick={()=>deleteWebhook(wh._id)} style={S.danger}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
