'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SENSOR_PRESETS, SCENARIO_PRESETS } from '@/lib/simulator';

type Device = { _id:string;deviceId:string;name:string;protocol:string;brokerUrl:string;topic:string;interval:number;isRunning:boolean;msgCount:number;sensors:any[] };
type Log = { _id:string;timestamp:string;payload:any;status:string;error?:string };
type Webhook = { _id:string;sensorName:string;operator:string;value:number;webhookUrl:string;triggerCount:number };

const INP:any = { background:'#080C10',border:'1px solid rgba(255,255,255,0.1)',color:'#E2E8F0',padding:'10px 14px',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%' };
const LBL:any = { fontSize:10,letterSpacing:2,color:'#475569',marginBottom:6,display:'block' };
const BTN = (on?:boolean):any => ({ background:on?'#00FF88':'transparent',border:`1px solid ${on?'#00FF88':'rgba(255,255,255,0.15)'}`,color:on?'#080C10':'#94A3B8',padding:'9px 16px',fontSize:11,letterSpacing:2,cursor:'pointer',fontFamily:'inherit',fontWeight:on?800:400,whiteSpace:'nowrap' as const });
const CARD:any = { background:'#0D1117',border:'1px solid rgba(255,255,255,0.08)',padding:18,marginBottom:12 };
const NAV_ITEMS = [['devices',' ','Devices'],['new','+','New'],['scenarios',' ','Scripts'],['webhooks',' ','Hooks']] as const;

export default function Dashboard() {
 const { data:session, status } = useSession();
 const router = useRouter();
 const [mounted, setMounted] = useState(false);
 const [isMobile, setIsMobile] = useState(false);
 const [menuOpen, setMenuOpen] = useState(false);
 const [devices, setDevices] = useState<Device[]>([]);
 const [selectedId, setSelectedId] = useState<string|null>(null);
 const [logs, setLogs] = useState<Log[]>([]);
 const [webhooks, setWebhooks] = useState<Webhook[]>([]);
 const [view, setView] = useState('devices');
 const [chaosMap, setChaosMap] = useState<Record<string,boolean>>({});
 const [shareUrl, setShareUrl] = useState('');
 const [csvRows, setCsvRows] = useState<any[]>([]);
 const csvRef = useRef<HTMLInputElement>(null);
 const [nd, setNd] = useState({ name:'',protocol:'mqtt',brokerUrl:'',username:'',password:'',topic:'',interval:2000,preset:'medical' });
 const [nw, setNw] = useState({ sensorName:'',operator:'gt',value:0,webhookUrl:'',method:'POST' });
 const [scenarioName, setScenarioName] = useState('');
 const [scenarioPreset, setScenarioPreset] = useState('Patient Deterioration');
 const [scenarioLoop, setScenarioLoop] = useState(false);

 const selected = devices.find(d => d.deviceId === selectedId) || null;

 useEffect(() => {
 setMounted(true);
 const check = () => setIsMobile(window.innerWidth < 768);
 check();
 window.addEventListener('resize', check);
 return () => window.removeEventListener('resize', check);
 }, []);

 useEffect(() => { if (status==='unauthenticated') router.push('/auth/login'); }, [status]);

 const loadDevices = useCallback(async () => {
 const r = await fetch('/api/devices'); const d = await r.json();
 if (d.success) setDevices(d.data);
 }, []);

 const loadLogs = useCallback(async (id:string) => {
 const r = await fetch(`/api/devices/${id}/logs`); const d = await r.json();
 if (d.success) setLogs(d.data);
 }, []);

 const loadWebhooks = useCallback(async (id:string) => {
 const r = await fetch(`/api/webhooks/threshold?deviceId=${id}`); const d = await r.json();
 if (d.success) setWebhooks(d.data);
 }, []);

 useEffect(() => { if (status==='authenticated') loadDevices(); }, [status]);

 useEffect(() => {
 if (!selectedId) return;
 loadLogs(selectedId); loadWebhooks(selectedId);
 const t = setInterval(() => loadLogs(selectedId), 3000);
 return () => clearInterval(t);
 }, [selectedId]);

 const selectDevice = (deviceId:string) => {
 setSelectedId(prev => prev === deviceId ? null : deviceId);
 setShareUrl('');
 };

 const toggle = async (d:Device, e:React.MouseEvent) => {
 e.stopPropagation();
 await fetch(`/api/simulator/${d.deviceId}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:d.isRunning?'stop':'start', chaosMode:chaosMap[d.deviceId], csvRows:csvRows.length?csvRows:undefined }) });
 await loadDevices();
 };

 const createDevice = async () => {
 const sensors = (SENSOR_PRESETS as any)[nd.preset] || SENSOR_PRESETS.medical;
 const r = await fetch('/api/devices', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...nd, sensors}) });
 const d = await r.json();
 if (d.success) { await loadDevices(); navigate('devices'); } else alert(d.error);
 };

 const createWebhook = async () => {
 if (!selected) return;
 const r = await fetch('/api/webhooks/threshold', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...nw, deviceId:selected.deviceId}) });
 const d = await r.json();
 if (d.success) { await loadWebhooks(selected.deviceId); setNw({sensorName:'',operator:'gt',value:0,webhookUrl:'',method:'POST'}); }
 };

 const deleteWebhook = async (id:string) => {
 await fetch(`/api/webhooks/threshold?id=${id}`, { method:'DELETE' });
 if (selected) loadWebhooks(selected.deviceId);
 };

 const saveScenario = async () => {
 if (!selected || !scenarioName) return;
 await fetch('/api/scenarios', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:scenarioName, deviceId:selected.deviceId, steps:(SCENARIO_PRESETS as any)[scenarioPreset], loop:scenarioLoop }) });
 alert('Scenario saved! Start the device to run it.');
 };

 const generateShare = async (deviceId:string, e:React.MouseEvent) => {
 e.stopPropagation();
 const r = await fetch('/api/share', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ deviceId }) });
 const d = await r.json();
 if (d.success) setShareUrl(d.data.shareUrl);
 };

 const handleCSV = async (e:any) => {
 const file = e.target.files?.[0]; if (!file) return;
 const fd = new FormData(); fd.append('file', file);
 const r = await fetch('/api/devices/csv', { method:'POST', body:fd });
 const d = await r.json();
 if (d.success) { setCsvRows(d.data.rows); alert(`${d.data.rowCount} rows loaded`); }
 };

 const startAll = async () => { await Promise.all(devices.filter(d=>!d.isRunning).map(d=>fetch(`/api/simulator/${d.deviceId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start'})}))); await loadDevices(); };
 const stopAll = async () => { await Promise.all(devices.filter(d=>d.isRunning).map(d=>fetch(`/api/simulator/${d.deviceId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop'})}))); await loadDevices(); };

 const navigate = (v:string) => { setView(v); setMenuOpen(false); if (v !== 'devices') setSelectedId(null); };
 const runningCount = devices.filter(d => d.isRunning).length;

 if (status === 'loading' || !mounted) {
 return <div style={{minHeight:'100vh',background:'#080C10',display:'flex',alignItems:'center',justifyContent:'center',color:'#00FF88',fontFamily:'monospace',fontSize:13,letterSpacing:2}}>LOADING...</div>;
 }

 const SidebarContent = () => (
 <div style={{display:'flex',flexDirection:'column' as const,height:'100%'}}>
 <div style={{padding:'20px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
 <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
 <div style={{width:7,height:7,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 8px #00FF88'}}/>
 <span style={{fontSize:14,fontWeight:800,color:'#00FF88',letterSpacing:2}}>SIMIOTX</span>
 </div>
 <div style={{fontSize:10,color:'#334155',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{session?.user?.email}</div>
 </div>
 <div style={{flex:1,padding:'12px 8px'}}>
 {NAV_ITEMS.map(([id,,label]) => (
 <button key={id} onClick={() => navigate(id)} style={{display:'block',width:'100%',textAlign:'left' as const,background:view===id?'rgba(0,255,136,0.08)':'transparent',border:'none',borderLeft:`2px solid ${view===id?'#00FF88':'transparent'}`,color:view===id?'#00FF88':'#475569',padding:'12px 14px',fontSize:11,letterSpacing:2,cursor:'pointer',fontFamily:'inherit',marginBottom:2}}>{label}</button>
 ))}
 </div>
 <div style={{padding:'16px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
 {runningCount > 0 && <div style={{fontSize:10,color:'#00FF88',marginBottom:8}}>● {runningCount} RUNNING</div>}
 <div style={{fontSize:10,color:'#334155',marginBottom:8}}>PLAN: <span style={{color:'#00FF88'}}>{((session?.user as any)?.plan||'FREE').toUpperCase()}</span></div>
 <button onClick={() => signOut({callbackUrl:'/'})} style={{...BTN(),fontSize:10,width:'100%',textAlign:'center' as const}}>SIGN OUT</button>
 </div>
 </div>
 );

 const MainContent = () => (<>
 {view === 'devices' && <>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,gap:10,flexWrap:'wrap' as const}}>
 <div>
 <div style={{fontSize:10,color:'#00FF88',letterSpacing:3,marginBottom:2}}>VIRTUAL DEVICES</div>
 <div style={{fontSize:20,fontWeight:800,color:'#F8FAFC'}}>{devices.length} device{devices.length!==1?'s':''}</div>
 </div>
 {devices.length > 1 && <div style={{display:'flex',gap:8}}><button onClick={startAll} style={BTN(true)}> ALL</button><button onClick={stopAll} style={BTN()}> ALL</button></div>}
 </div>

 {devices.length === 0 && (
 <div style={{...CARD,textAlign:'center' as const,padding:40}}>
 <div style={{fontSize:28,marginBottom:10}}> </div>
 <div style={{color:'#475569',fontSize:13,marginBottom:14}}>No devices yet.</div>
 <button onClick={() => navigate('new')} style={BTN(true)}>CREATE DEVICE →</button>
 </div>
 )}

 {devices.map(device => (
 <div key={device._id} onClick={() => selectDevice(device.deviceId)}
 style={{...CARD,borderLeft:`3px solid ${device.isRunning?'#00FF88':'#334155'}`,cursor:'pointer',border:selectedId===device.deviceId?'1px solid rgba(0,255,136,0.4)':'1px solid rgba(255,255,255,0.08)',borderLeftWidth:3,borderLeftColor:device.isRunning?'#00FF88':'#334155'}}>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
 <div style={{flex:1,minWidth:0,paddingRight:8}}>
 <div style={{fontSize:14,fontWeight:700,color:'#F8FAFC',marginBottom:2}}>{device.name}</div>
 <div style={{fontSize:10,color:'#475569'}}>{device.protocol.toUpperCase()} · {device.interval/1000}s · {device.msgCount} msgs</div>
 </div>
 <div style={{fontSize:9,fontWeight:800,color:device.isRunning?'#080C10':'#475569',background:device.isRunning?'#00FF88':'transparent',border:`1px solid ${device.isRunning?'#00FF88':'#334155'}`,padding:'3px 8px',flexShrink:0}}>{device.isRunning?'LIVE':'OFF'}</div>
 </div>
 <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
 <button onClick={(e)=>toggle(device,e)} style={BTN(device.isRunning)}>{device.isRunning?' STOP':' START'}</button>
 <button onClick={(e)=>{e.stopPropagation();setChaosMap(m=>({...m,[device.deviceId]:!m[device.deviceId]}));}} style={{...BTN(chaosMap[device.deviceId]),padding:'9px 12px',fontSize:10}}> {chaosMap[device.deviceId]?'CHAOS ON':'CHAOS'}</button>
 <button onClick={(e)=>{e.stopPropagation();csvRef.current?.click();}} style={{...BTN(csvRows.length>0),padding:'9px 12px',fontSize:10}}> CSV</button>
 <button onClick={(e)=>generateShare(device.deviceId,e)} style={{...BTN(),padding:'9px 12px',fontSize:10}}> SHARE</button>
 </div>
 {shareUrl && selectedId===device.deviceId && (
 <div style={{marginTop:10,padding:10,background:'rgba(0,255,136,0.05)',border:'1px solid rgba(0,255,136,0.2)',fontSize:10,color:'#00FF88',wordBreak:'break-all' as const}}>
 {shareUrl}
 <button onClick={(e)=>{e.stopPropagation();navigator.clipboard.writeText(shareUrl);}} style={{...BTN(true),marginTop:8,fontSize:9,padding:'4px 10px',display:'block'}}>COPY LINK</button>
 </div>
 )}
 {selectedId===device.deviceId && (
 <div style={{marginTop:12,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:12}} onClick={e=>e.stopPropagation()}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:10,display:'flex',justifyContent:'space-between'}}>
 <span>LIVE LOGS</span>
 {device.isRunning && <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:6,height:6,borderRadius:'50%',background:'#00FF88',display:'inline-block'}}/>LIVE</span>}
 </div>
 <div style={{maxHeight:260,overflowY:'auto' as const,fontSize:10}}>
 {logs.length===0 ? <div style={{color:'#334155',textAlign:'center' as const,padding:20}}>Start simulator to see logs</div> :
 logs.map((log,i) => (
 <div key={log._id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',opacity:Math.max(0.3,1-i*0.06)}}>
 <div style={{color:'#475569',marginBottom:2}}>{new Date(log.timestamp).toLocaleTimeString()} <span style={{color:log.status==='sent'?'#00FF88':'#FF4444'}}>[{log.status.toUpperCase()}]</span></div>
 <div style={{color:'#94A3B8',wordBreak:'break-all' as const}}>{JSON.stringify(log.payload)}</div>
 {log.error && <div style={{color:'#FF4444'}}>{log.error}</div>}
 </div>
 ))
 }
 </div>
 </div>
 )}
 </div>
 ))}
 <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}}/>
 </>}

 {view === 'new' && <>
 <div style={{marginBottom:20}}>
 <div style={{fontSize:10,color:'#00FF88',letterSpacing:3,marginBottom:4}}>NEW DEVICE</div>
 <div style={{fontSize:20,fontWeight:800,color:'#F8FAFC'}}>Configure virtual device</div>
 </div>
 <div style={CARD}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:16}}>CONNECTION</div>
 <div style={{marginBottom:14}}><label style={LBL}>DEVICE NAME</label><input value={nd.name} onChange={e=>setNd(d=>({...d,name:e.target.value}))} placeholder="e.g. Hospital Bed 1" style={INP}/></div>
 <div style={{marginBottom:14}}>
 <label style={LBL}>PROTOCOL</label>
 <div style={{display:'flex',gap:8}}>{['mqtt','http'].map(p=><button key={p} onClick={()=>setNd(d=>({...d,protocol:p}))} style={BTN(nd.protocol===p)}>{p.toUpperCase()}</button>)}</div>
 </div>
 <div style={{marginBottom:14}}><label style={LBL}>{nd.protocol==='mqtt'?'BROKER URL':'HTTP ENDPOINT'}</label><input value={nd.brokerUrl} onChange={e=>setNd(d=>({...d,brokerUrl:e.target.value}))} placeholder={nd.protocol==='mqtt'?'mqtts://xxx.hivemq.cloud:8883':'https://api.example.com/data'} style={INP}/></div>
 {nd.protocol==='mqtt' && <>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
 <div><label style={LBL}>USERNAME</label><input value={nd.username} onChange={e=>setNd(d=>({...d,username:e.target.value}))} style={INP}/></div>
 <div><label style={LBL}>PASSWORD</label><input type="password" value={nd.password} onChange={e=>setNd(d=>({...d,password:e.target.value}))} style={INP}/></div>
 </div>
 <div style={{marginBottom:14}}><label style={LBL}>TOPIC</label><input value={nd.topic} onChange={e=>setNd(d=>({...d,topic:e.target.value}))} placeholder="e.g. mediwatch/patient/P001/vitals" style={INP}/></div>
 </>}
 <div><label style={LBL}>SEND INTERVAL</label>
 <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>{[1000,2000,5000,10000].map(ms=><button key={ms} onClick={()=>setNd(d=>({...d,interval:ms}))} style={BTN(nd.interval===ms)}>{ms/1000}s</button>)}</div>
 </div>
 </div>
 <div style={CARD}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:14}}>SENSOR PRESET</div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8,marginBottom:12}}>
 {Object.keys(SENSOR_PRESETS).map(p=>(
 <button key={p} onClick={()=>setNd(d=>({...d,preset:p}))} style={{...BTN(nd.preset===p),textAlign:'left' as const,padding:'10px 14px'}}>
 <div style={{textTransform:'uppercase' as const,letterSpacing:1,fontSize:11}}>{p}</div>
 <div style={{fontSize:10,marginTop:3,color:nd.preset===p?'#080C10':'#334155'}}>{(SENSOR_PRESETS as any)[p].length} sensors</div>
 </button>
 ))}
 </div>
 <div style={{fontSize:10,color:'#475569'}}>Sensors: {(SENSOR_PRESETS as any)[nd.preset]?.map((s:any)=>s.name).join(', ')}</div>
 </div>
 <div style={{display:'flex',gap:10}}>
 <button onClick={createDevice} disabled={!nd.name||!nd.brokerUrl} style={{...BTN(true),flex:1,padding:'13px',opacity:(!nd.name||!nd.brokerUrl)?0.4:1}}>CREATE DEVICE →</button>
 <button onClick={()=>navigate('devices')} style={BTN()}>CANCEL</button>
 </div>
 </>}

 {view === 'scenarios' && <>
 <div style={{marginBottom:20}}>
 <div style={{fontSize:10,color:'#00FF88',letterSpacing:3,marginBottom:4}}>SCENARIO SCRIPTING</div>
 <div style={{fontSize:20,fontWeight:800,color:'#F8FAFC'}}>Script sensor behaviour over time</div>
 <div style={{fontSize:12,color:'#475569',marginTop:6}}>Simulator gradually moves toward each target value.</div>
 </div>
 {!selected ? <div style={{...CARD,textAlign:'center' as const,padding:32,color:'#475569',fontSize:13}}>Go to Devices and tap a device first</div> : (
 <div style={CARD}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:14}}>FOR: {selected.name}</div>
 <div style={{marginBottom:14}}><label style={LBL}>SCENARIO NAME</label><input value={scenarioName} onChange={e=>setScenarioName(e.target.value)} placeholder="e.g. Patient Deterioration Test" style={INP}/></div>
 <div style={{marginBottom:14}}>
 <label style={LBL}>PRESET SCRIPT</label>
 <select value={scenarioPreset} onChange={e=>setScenarioPreset(e.target.value)} style={{...INP,appearance:'none' as const}}>
 {Object.keys(SCENARIO_PRESETS).map(p=><option key={p} value={p}>{p}</option>)}
 </select>
 </div>
 <div style={{marginBottom:14}}>
 {(SCENARIO_PRESETS as any)[scenarioPreset]?.map((step:any,i:number)=>(
 <div key={i} style={{display:'flex',gap:10,padding:'8px 10px',background:i%2===0?'rgba(255,255,255,0.02)':'transparent',fontSize:11}}>
 <span style={{color:'#00FF88',minWidth:16}}>{i+1}.</span>
 <span style={{color:'#F8FAFC',flex:1}}>{step.label}</span>
 <span style={{color:'#475569'}}>{step.durationSeconds}s</span>
 </div>
 ))}
 </div>
 <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
 <button onClick={()=>setScenarioLoop(l=>!l)} style={BTN(scenarioLoop)}> LOOP</button>
 <span style={{fontSize:11,color:'#475569'}}>{scenarioLoop?'Repeats forever':'Stops at last step'}</span>
 </div>
 <button onClick={saveScenario} disabled={!scenarioName} style={{...BTN(true),width:'100%',padding:'12px',opacity:!scenarioName?0.4:1}}>SAVE SCENARIO →</button>
 </div>
 )}
 </>}

 {view === 'webhooks' && <>
 <div style={{marginBottom:20}}>
 <div style={{fontSize:10,color:'#00FF88',letterSpacing:3,marginBottom:4}}>THRESHOLD WEBHOOKS</div>
 <div style={{fontSize:20,fontWeight:800,color:'#F8FAFC'}}>Trigger HTTP calls on threshold</div>
 <div style={{fontSize:12,color:'#475569',marginTop:6}}>When simulator crosses a threshold, it hits your webhook instantly.</div>
 </div>
 {!selected ? <div style={{...CARD,textAlign:'center' as const,padding:32,color:'#475569',fontSize:13}}>Go to Devices and tap a device first</div> : <>
 <div style={CARD}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:14}}>ADD WEBHOOK FOR: {selected.name}</div>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
 <div><label style={LBL}>SENSOR NAME</label><input value={nw.sensorName} onChange={e=>setNw(w=>({...w,sensorName:e.target.value}))} placeholder="e.g. heartRate" style={INP}/></div>
 <div><label style={LBL}>CONDITION</label>
 <select value={nw.operator} onChange={e=>setNw(w=>({...w,operator:e.target.value}))} style={{...INP,appearance:'none' as const}}>
 {[['gt','> greater than'],['lt','< less than'],['gte','>= at least'],['lte','<= at most'],['eq','= equals']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
 </select>
 </div>
 </div>
 <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:12}}>
 <div><label style={LBL}>VALUE</label><input type="number" value={nw.value} onChange={e=>setNw(w=>({...w,value:+e.target.value}))} style={INP}/></div>
 <div><label style={LBL}>WEBHOOK URL</label><input value={nw.webhookUrl} onChange={e=>setNw(w=>({...w,webhookUrl:e.target.value}))} placeholder="https://your-api.com/alert" style={INP}/></div>
 </div>
 <div style={{display:'flex',gap:8,marginBottom:14}}>{['POST','GET'].map(m=><button key={m} onClick={()=>setNw(w=>({...w,method:m}))} style={BTN(nw.method===m)}>{m}</button>)}</div>
 <button onClick={createWebhook} disabled={!nw.sensorName||!nw.webhookUrl} style={{...BTN(true),opacity:(!nw.sensorName||!nw.webhookUrl)?0.4:1}}>ADD WEBHOOK →</button>
 </div>
 {webhooks.length > 0 && (
 <div style={CARD}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:14}}>ACTIVE WEBHOOKS</div>
 {webhooks.map(wh=>(
 <div key={wh._id} style={{padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.06)',fontSize:12}}>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap' as const,gap:8}}>
 <span style={{color:'#F8FAFC'}}>{wh.sensorName} <span style={{color:'#475569'}}>{wh.operator}</span> <span style={{color:'#00FF88'}}>{wh.value}</span></span>
 <div style={{display:'flex',alignItems:'center',gap:10}}>
 <span style={{fontSize:10,color:'#475569'}}>fired {wh.triggerCount}x</span>
 <button onClick={()=>deleteWebhook(wh._id)} style={{background:'transparent',border:'1px solid rgba(255,68,68,0.4)',color:'#FF4444',padding:'4px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>×</button>
 </div>
 </div>
 <div style={{fontSize:10,color:'#334155',marginTop:4,wordBreak:'break-all' as const}}>{wh.webhookUrl}</div>
 </div>
 ))}
 </div>
 )}
 </>}
 </>}
 </>);

 // MOBILE
 if (isMobile) return (
 <div style={{minHeight:'100vh',background:'#080C10',fontFamily:'"JetBrains Mono",monospace',color:'#E2E8F0'}}>
 <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}select{background:#080C10;color:#E2E8F0}`}</style>
 <div style={{position:'sticky',top:0,zIndex:100,background:'#080C10',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
 <div style={{display:'flex',alignItems:'center',gap:8}}>
 <div style={{width:7,height:7,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 8px #00FF88'}}/>
 <span style={{fontSize:13,fontWeight:800,color:'#00FF88',letterSpacing:2}}>SIMIOTX</span>
 {runningCount > 0 && <span style={{background:'#00FF88',color:'#080C10',fontSize:9,fontWeight:800,padding:'2px 6px'}}>{runningCount} LIVE</span>}
 </div>
 <button onClick={()=>setMenuOpen(m=>!m)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'#94A3B8',width:36,height:36,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
 {menuOpen
 ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/></svg>
 : <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><rect width="18" height="2" rx="1" fill="#94A3B8"/><rect y="6" width="18" height="2" rx="1" fill="#94A3B8"/><rect y="12" width="18" height="2" rx="1" fill="#94A3B8"/></svg>
 }
 </button>
 </div>
 {menuOpen && (
 <div style={{background:'#0D1117',borderBottom:'1px solid rgba(255,255,255,0.08)',padding:'8px 0'}}>
 {NAV_ITEMS.map(([id,,label])=>(
 <button key={id} onClick={()=>navigate(id)} style={{display:'block',width:'100%',textAlign:'left' as const,background:view===id?'rgba(0,255,136,0.08)':'transparent',border:'none',borderLeft:`2px solid ${view===id?'#00FF88':'transparent'}`,color:view===id?'#00FF88':'#475569',padding:'13px 16px',fontSize:11,letterSpacing:2,cursor:'pointer',fontFamily:'inherit'}}>{label}</button>
 ))}
 <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.06)',marginTop:4}}>
 <div style={{fontSize:10,color:'#334155',marginBottom:8}}>PLAN: <span style={{color:'#00FF88'}}>{((session?.user as any)?.plan||'FREE').toUpperCase()}</span></div>
 <button onClick={()=>signOut({callbackUrl:'/'})} style={{...BTN(),fontSize:10,width:'100%',textAlign:'center' as const}}>SIGN OUT</button>
 </div>
 </div>
 )}
 <div style={{padding:'16px 14px',paddingBottom:80}}><MainContent/></div>
 <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#0D1117',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',zIndex:100}}>
 {NAV_ITEMS.map(([id,icon,label])=>(
 <button key={id} onClick={()=>navigate(id)} style={{flex:1,background:'transparent',border:'none',borderTop:`2px solid ${view===id?'#00FF88':'transparent'}`,color:view===id?'#00FF88':'#475569',padding:'10px 4px',fontSize:10,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column' as const,alignItems:'center',gap:3}}>
 <span style={{fontSize:16}}>{icon}</span>
 <span style={{letterSpacing:1,fontSize:9}}>{label}</span>
 </button>
 ))}
 </div>
 </div>
 );

 // DESKTOP
 return (
 <div style={{display:'flex',minHeight:'100vh',background:'#080C10',fontFamily:'"JetBrains Mono",monospace',color:'#E2E8F0'}}>
 <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px;background:#080C10}::-webkit-scrollbar-thumb{background:#1a2a1a}select{background:#080C10;color:#E2E8F0}`}</style>
 <div style={{width:220,borderRight:'1px solid rgba(255,255,255,0.06)',minHeight:'100vh',flexShrink:0,position:'sticky',top:0,height:'100vh',overflowY:'auto' as const}}>
 <SidebarContent/>
 </div>
 <div style={{flex:1,padding:28,overflowY:'auto' as const,maxHeight:'100vh'}}>
 <MainContent/>
 </div>
 </div>
 );
}