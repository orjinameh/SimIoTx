'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SENSOR_PRESETS, SCENARIO_PRESETS } from '@/lib/simulator';

type Device = { _id:string;deviceId:string;name:string;protocol:string;brokerUrl:string;topic:string;interval:number;isRunning:boolean;msgCount:number;sensors:any[] };
type Log = { _id:string;timestamp:string;payload:any;status:string;error?:string };
type Webhook = { _id:string;sensorName:string;operator:string;value:number;webhookUrl:string;triggerCount:number };

const inp = { background:'#080C10',border:'1px solid rgba(255,255,255,0.1)',color:'#E2E8F0',padding:'10px 14px',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%' };
const lbl = { fontSize:10,letterSpacing:2,color:'#475569',marginBottom:6,display:'block' };
const btn = (on?:boolean):any => ({ background:on?'#00FF88':'transparent',border:`1px solid ${on?'#00FF88':'rgba(255,255,255,0.15)'}`,color:on?'#080C10':'#94A3B8',padding:'9px 16px',fontSize:11,letterSpacing:2,cursor:'pointer',fontFamily:'inherit',fontWeight:on?800:400 });
const card:any = { background:'#0D1117',border:'1px solid rgba(255,255,255,0.08)',padding:18,marginBottom:12,borderRadius:2 };

export default function Dashboard() {
const { data:session, status } = useSession();
const router = useRouter();
const [devices, setDevices] = useState<Device[]>([]);
const [selected, setSelected] = useState<Device|null>(null);
const [logs, setLogs] = useState<Log[]>([]);
const [webhooks, setWebhooks] = useState<Webhook[]>([]);
const [view, setView] = useState('devices');
const [menuOpen, setMenuOpen] = useState(false);
const [chaosMap, setChaosMap] = useState<Record<string,boolean>>({});
const [shareUrl, setShareUrl] = useState('');
const [csvRows, setCsvRows] = useState<any[]>([]);
const csvRef = useRef<HTMLInputElement>(null);
const [nd, setNd] = useState({ name:'',protocol:'mqtt',brokerUrl:'',username:'',password:'',topic:'',interval:2000,preset:'medical' });
const [nw, setNw] = useState({ sensorName:'',operator:'gt',value:0,webhookUrl:'',method:'POST' });
const [scenarioName, setScenarioName] = useState('');
const [scenarioPreset, setScenarioPreset] = useState('Patient Deterioration');
const [scenarioLoop, setScenarioLoop] = useState(false);

useEffect(() => { if (status==='unauthenticated') router.push('/auth/login'); },[status]);

const loadDevices = useCallback(async () => { const r=await fetch('/api/devices');const d=await r.json();if(d.success)setDevices(d.data); },[]);
const loadLogs = useCallback(async (id:string) => { const r=await fetch(`/api/devices/${id}/logs`);const d=await r.json();if(d.success)setLogs(d.data); },[]);
const loadWebhooks = useCallback(async (id:string) => { const r=await fetch(`/api/webhooks/threshold?deviceId=${id}`);const d=await r.json();if(d.success)setWebhooks(d.data); },[]);

useEffect(() => { if(status==='authenticated')loadDevices(); },[status]);
useEffect(() => {
if(!selected)return;
loadLogs(selected.deviceId);loadWebhooks(selected.deviceId);
const t=setInterval(()=>loadLogs(selected.deviceId),3000);
return ()=>clearInterval(t);
},[selected]);

const toggle = async (d:Device) => { await fetch(`/api/simulator/${d.deviceId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:d.isRunning?'stop':'start',chaosMode:chaosMap[d.deviceId],csvRows:csvRows.length?csvRows:undefined})}); await loadDevices(); };
const createDevice = async () => { const sensors=(SENSOR_PRESETS as any)[nd.preset]||SENSOR_PRESETS.medical;const r=await fetch('/api/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...nd,sensors})});const d=await r.json();if(d.success){await loadDevices();setView('devices');}else alert(d.error); };
const createWebhook = async () => { if(!selected)return;const r=await fetch('/api/webhooks/threshold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...nw,deviceId:selected.deviceId})});const d=await r.json();if(d.success){await loadWebhooks(selected.deviceId);setNw({sensorName:'',operator:'gt',value:0,webhookUrl:'',method:'POST'});} };
const deleteWebhook = async (id:string) => { await fetch(`/api/webhooks/threshold?id=${id}`,{method:'DELETE'});if(selected)loadWebhooks(selected.deviceId); };
const saveScenario = async () => { if(!selected||!scenarioName)return;await fetch('/api/scenarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:scenarioName,deviceId:selected.deviceId,steps:(SCENARIO_PRESETS as any)[scenarioPreset],loop:scenarioLoop})});alert('Scenario saved!'); };
const generateShare = async (deviceId:string) => { const r=await fetch('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId})});const d=await r.json();if(d.success)setShareUrl(d.data.shareUrl); };
const handleCSV = async (e:any) => { const file=e.target.files?.[0];if(!file)return;const fd=new FormData();fd.append('file',file);const r=await fetch('/api/devices/csv',{method:'POST',body:fd});const d=await r.json();if(d.success){setCsvRows(d.data.rows);alert(`${d.data.rowCount} rows loaded`);} };
const startAll = async () => { await Promise.all(devices.filter(d=>!d.isRunning).map(d=>fetch(`/api/simulator/${d.deviceId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start'})}))); await loadDevices(); };
const stopAll = async () => { await Promise.all(devices.filter(d=>d.isRunning).map(d=>fetch(`/api/simulator/${d.deviceId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop'})}))); await loadDevices(); };

const nav = (v:string) => { setView(v);setMenuOpen(false);setSelected(null); };
const runningCount = devices.filter(d=>d.isRunning).length;

if(status==='loading') return <div style={{minHeight:'100vh',background:'#080C10',display:'flex',alignItems:'center',justifyContent:'center',color:'#00FF88',fontFamily:'monospace'}}>LOADING…</div>;

const NavItems = () => <>
{[['devices',' Devices'],['new','+ New Device'],['scenarios',' Scenarios'],['webhooks',' Webhooks']].map(([id,lbl])=>(
<button key={id} onClick={()=>nav(id)} style={{display:'block',width:'100%',textAlign:'left' as const,background:view===id?'rgba(0,255,136,0.08)':'transparent',border:'none',borderLeft:`2px solid ${view===id?'#00FF88':'transparent'}`,color:view===id?'#00FF88':'#475569',padding:'12px 16px',fontSize:11,letterSpacing:2,cursor:'pointer',fontFamily:'inherit',marginBottom:2}}>{lbl}</button>
))}
</>;

return (
<div style={{minHeight:'100vh',background:'#080C10',fontFamily:'“JetBrains Mono”,monospace',color:'#E2E8F0'}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:4px;background:#080C10} ::-webkit-scrollbar-thumb{background:#1a2a1a} select{background:#080C10;color:#E2E8F0;border:1px solid rgba(255,255,255,0.1);padding:10px 14px;font-family:inherit;font-size:13px;outline:none;width:100%}`}</style>

```
 {/* MOBILE HEADER */}
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'#080C10',position:'sticky',top:0,zIndex:100}}>
 <div style={{display:'flex',alignItems:'center',gap:8}}>
 <div style={{width:7,height:7,borderRadius:'50%',background:'#00FF88',boxShadow:'0 0 8px #00FF88'}}/>
 <span style={{fontSize:14,fontWeight:800,color:'#00FF88',letterSpacing:2}}>SIMIOTX</span>
 {runningCount>0&&<span style={{background:'#00FF88',color:'#080C10',fontSize:9,fontWeight:800,padding:'2px 6px',letterSpacing:1}}>{runningCount} LIVE</span>}
 </div>
 <div style={{display:'flex',alignItems:'center',gap:8}}>
 <span style={{fontSize:11,color:'#475569',display:menuOpen?'none':'block'}}>{view.toUpperCase()}</span>
 <button onClick={()=>setMenuOpen(m=>!m)} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:'#94A3B8',width:36,height:36,fontSize:16,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center'}}>{menuOpen?'✕':'☰'}</button>
 </div>
 </div>

 {/* MOBILE DROPDOWN */}
 {menuOpen&&(
 <div style={{background:'#0D1117',borderBottom:'1px solid rgba(255,255,255,0.08)',padding:'8px 0',position:'sticky',top:57,zIndex:99}}>
 <NavItems/>
 <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.06)',marginTop:8}}>
 <div style={{fontSize:10,color:'#334155',marginBottom:8}}>PLAN: <span style={{color:'#00FF88'}}>{((session?.user as any)?.plan||'FREE').toUpperCase()}</span></div>
 <button onClick={()=>signOut({callbackUrl:'/'})} style={{...btn(),fontSize:10,width:'100%',textAlign:'center' as const}}>SIGN OUT</button>
 </div>
 </div>
 )}

 {/* DESKTOP LAYOUT */}
 <div style={{display:'flex'}}>
 {/* Desktop sidebar - hidden on mobile */}
 <div style={{width:220,borderRight:'1px solid rgba(255,255,255,0.06)',minHeight:'calc(100vh - 57px)',padding:'16px 0',display:'none',flexDirection:'column' as const}} className="desktop-sidebar">
 <div style={{flex:1,padding:'0 8px'}}><NavItems/></div>
 <div style={{padding:'16px',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
 <div style={{fontSize:10,color:'#334155',marginBottom:8}}>PLAN: <span style={{color:'#00FF88'}}>{((session?.user as any)?.plan||'FREE').toUpperCase()}</span></div>
 <button onClick={()=>signOut({callbackUrl:'/'})} style={{...btn(),fontSize:10,width:'100%',textAlign:'center' as const}}>SIGN OUT</button>
 </div>
 </div>

 {/* MAIN CONTENT */}
 <div style={{flex:1,padding:'20px 16px',maxWidth:'100%',overflowX:'hidden'}}>

 {/* ── DEVICES ── */}
 {view==='devices'&&<>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,flexWrap:'wrap',gap:10}}>
 <div>
 <div style={{fontSize:10,color:'#00FF88',letterSpacing:3,marginBottom:2}}>VIRTUAL DEVICES</div>
 <div style={{fontSize:20,fontWeight:800,color:'#F8FAFC'}}>{devices.length} device{devices.length!==1?'s':''}</div>
 </div>
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
 {devices.length>1&&<><button onClick={startAll} style={btn(true)}> ALL</button><button onClick={stopAll} style={btn()}> ALL</button></>}
 </div>
 </div>

 {devices.length===0&&(
 <div style={{...card,textAlign:'center' as const,padding:40}}>
 <div style={{fontSize:28,marginBottom:10}}> </div>
 <div style={{color:'#475569',fontSize:13,marginBottom:14}}>No devices yet.</div>
 <button onClick={()=>setView('new')} style={btn(true)}>CREATE DEVICE →</button>
 </div>
 )}

 {devices.map(device=>(
 <div key={device._id} style={{...card,borderLeft:`3px solid ${device.isRunning?'#00FF88':'#334155'}`}}>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
 <div onClick={()=>setSelected(s=>s?.deviceId===device.deviceId?null:device)} style={{cursor:'pointer',flex:1}}>
 <div style={{fontSize:14,fontWeight:700,color:'#F8FAFC',marginBottom:2}}>{device.name}</div>
 <div style={{fontSize:10,color:'#475569'}}>{device.protocol.toUpperCase()} · {device.interval/1000}s · {device.msgCount} msgs</div>
 </div>
 <div style={{fontSize:9,letterSpacing:2,fontWeight:800,color:device.isRunning?'#080C10':'#475569',background:device.isRunning?'#00FF88':'transparent',border:`1px solid ${device.isRunning?'#00FF88':'#334155'}`,padding:'3px 8px',whiteSpace:'nowrap' as const}}>{device.isRunning?'LIVE':'OFF'}</div>
 </div>

 <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:selected?.deviceId===device.deviceId?12:0}}>
 <button onClick={()=>toggle(device)} style={btn(device.isRunning)}>{device.isRunning?' STOP':' START'}</button>
 <button onClick={()=>setChaosMap(m=>({...m,[device.deviceId]:!m[device.deviceId]}))} style={{...btn(chaosMap[device.deviceId]),fontSize:10}}> {chaosMap[device.deviceId]?'CHAOS ON':'CHAOS'}</button>
 <button onClick={()=>csvRef.current?.click()} style={{...btn(csvRows.length>0),fontSize:10}}> CSV</button>
 <button onClick={()=>generateShare(device.deviceId)} style={{...btn(),fontSize:10}}> SHARE</button>
 </div>

 {shareUrl&&selected?.deviceId===device.deviceId&&(
 <div style={{marginTop:10,padding:10,background:'rgba(0,255,136,0.05)',border:'1px solid rgba(0,255,136,0.2)',fontSize:10,color:'#00FF88',wordBreak:'break-all' as const}}>
 {shareUrl}
 <button onClick={()=>navigator.clipboard.writeText(shareUrl)} style={{...btn(true),marginTop:6,fontSize:9,padding:'4px 10px',display:'block'}}>COPY</button>
 </div>
 )}

 {selected?.deviceId===device.deviceId&&(
 <div style={{marginTop:12,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:12}}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
 <span>LIVE LOGS</span>
 {device.isRunning&&<span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#00FF88',display:'inline-block',boxShadow:'0 0 6px #00FF88'}}/>STREAMING</span>}
 </div>
 <div style={{maxHeight:280,overflowY:'auto' as const,fontSize:10}}>
 {logs.length===0?<div style={{color:'#334155',textAlign:'center' as const,padding:20}}>Start simulator to see logs</div>:
 logs.map((log,i)=>(
 <div key={log._id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',opacity:1-i*0.05}}>
 <div style={{color:'#475569',marginBottom:2}}>{new Date(log.timestamp).toLocaleTimeString()} <span style={{color:log.status==='sent'?'#00FF88':'#FF4444'}}>[{log.status.toUpperCase()}]</span></div>
 <div style={{color:'#94A3B8',wordBreak:'break-all' as const}}>{JSON.stringify(log.payload)}</div>
 {log.error&&<div style={{color:'#FF4444'}}>{log.error}</div>}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 ))}
 <input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}}/>
 </>}

 {/* ── NEW DEVICE ── */}
 {view==='new'&&<>
 <div style={{marginBottom:20}}>
 <div style={{fontSize:10,color:'#00FF88',letterSpacing:3,marginBottom:4}}>NEW DEVICE</div>
 <div style={{fontSize:20,fontWeight:800,color:'#F8FAFC'}}>Configure virtual device</div>
 </div>
 <div style={card}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:16}}>CONNECTION</div>
 <div style={{marginBottom:14}}><label style={lbl}>DEVICE NAME</label><input value={nd.name} onChange={e=>setNd(d=>({...d,name:e.target.value}))} placeholder="e.g. Hospital Bed 1" style={inp}/></div>
 <div style={{marginBottom:14}}>
 <label style={lbl}>PROTOCOL</label>
 <div style={{display:'flex',gap:8}}>{['mqtt','http'].map(p=><button key={p} onClick={()=>setNd(d=>({...d,protocol:p}))} style={btn(nd.protocol===p)}>{p.toUpperCase()}</button>)}</div>
 </div>
 <div style={{marginBottom:14}}><label style={lbl}>{nd.protocol==='mqtt'?'BROKER URL':'HTTP ENDPOINT'}</label><input value={nd.brokerUrl} onChange={e=>setNd(d=>({...d,brokerUrl:e.target.value}))} placeholder={nd.protocol==='mqtt'?'mqtts://xxx.hivemq.cloud:8883':'https://api.example.com/data'} style={inp}/></div>
 {nd.protocol==='mqtt'&&<>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
 <div><label style={lbl}>USERNAME</label><input value={nd.username} onChange={e=>setNd(d=>({...d,username:e.target.value}))} style={inp}/></div>
 <div><label style={lbl}>PASSWORD</label><input type="password" value={nd.password} onChange={e=>setNd(d=>({...d,password:e.target.value}))} style={inp}/></div>
 </div>
 <div style={{marginBottom:14}}><label style={lbl}>TOPIC</label><input value={nd.topic} onChange={e=>setNd(d=>({...d,topic:e.target.value}))} placeholder="e.g. hospital/patient/P001/vitals" style={inp}/></div>
 </>}
 <div style={{marginBottom:0}}>
 <label style={lbl}>SEND INTERVAL</label>
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[1000,2000,5000,10000].map(ms=><button key={ms} onClick={()=>setNd(d=>({...d,interval:ms}))} style={btn(nd.interval===ms)}>{ms/1000}s</button>)}</div>
 </div>
 </div>

 <div style={card}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:14}}>SENSOR PRESET</div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8,marginBottom:12}}>
 {Object.keys(SENSOR_PRESETS).map(p=>(
 <button key={p} onClick={()=>setNd(d=>({...d,preset:p}))} style={{...btn(nd.preset===p),textAlign:'left' as const,padding:'10px 14px'}}>
 <div style={{textTransform:'uppercase' as const,letterSpacing:1,fontSize:11}}>{p}</div>
 <div style={{fontSize:10,marginTop:3,color:nd.preset===p?'#080C10':'#334155'}}>{(SENSOR_PRESETS as any)[p].length} sensors</div>
 </button>
 ))}
 </div>
 <div style={{fontSize:10,color:'#475569'}}>Sensors: {(SENSOR_PRESETS as any)[nd.preset]?.map((s:any)=>s.name).join(', ')}</div>
 </div>

 <div style={{display:'flex',gap:10}}>
 <button onClick={createDevice} disabled={!nd.name||!nd.brokerUrl} style={{...btn(true),flex:1,padding:'13px',opacity:(!nd.name||!nd.brokerUrl)?0.4:1}}>CREATE DEVICE →</button>
 <button onClick={()=>setView('devices')} style={btn()}>CANCEL</button>
 </div>
 </>}

 {/* ── SCENARIOS ── */}
 {view==='scenarios'&&<>
 <div style={{marginBottom:20}}>
 <div style={{fontSize:10,color:'#00FF88',letterSpacing:3,marginBottom:4}}>SCENARIO SCRIPTING</div>
 <div style={{fontSize:20,fontWeight:800,color:'#F8FAFC'}}>Script sensor behaviour over time</div>
 <div style={{fontSize:12,color:'#475569',marginTop:6}}>Define sequences — simulator gradually moves toward each target value.</div>
 </div>
 {!selected?<div style={{...card,textAlign:'center' as const,padding:32,color:'#475569',fontSize:13}}>Go to Devices and tap a device first</div>:(
 <div style={card}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:14}}>FOR: {selected.name}</div>
 <div style={{marginBottom:14}}><label style={lbl}>SCENARIO NAME</label><input value={scenarioName} onChange={e=>setScenarioName(e.target.value)} placeholder="e.g. Patient Deterioration Test" style={inp}/></div>
 <div style={{marginBottom:14}}><label style={lbl}>PRESET SCRIPT</label>
 <select value={scenarioPreset} onChange={e=>setScenarioPreset(e.target.value)}>
 {Object.keys(SCENARIO_PRESETS).map(p=><option key={p} value={p}>{p}</option>)}
 </select>
 </div>
 <div style={{marginBottom:14}}>
 {(SCENARIO_PRESETS as any)[scenarioPreset]?.map((step:any,i:number)=>(
 <div key={i} style={{display:'flex',gap:10,padding:'8px 10px',background:i%2===0?'rgba(255,255,255,0.02)':'transparent',fontSize:11,flexWrap:'wrap' as const}}>
 <span style={{color:'#00FF88',minWidth:16}}>{i+1}.</span>
 <span style={{color:'#F8FAFC',flex:1}}>{step.label}</span>
 <span style={{color:'#475569'}}>{step.durationSeconds}s</span>
 </div>
 ))}
 </div>
 <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
 <button onClick={()=>setScenarioLoop(l=>!l)} style={btn(scenarioLoop)}> LOOP</button>
 <span style={{fontSize:11,color:'#475569'}}>{scenarioLoop?'Repeats forever':'Stops at last step'}</span>
 </div>
 <button onClick={saveScenario} disabled={!scenarioName} style={{...btn(true),width:'100%',padding:'12px',opacity:!scenarioName?0.4:1}}>SAVE SCENARIO →</button>
 </div>
 )}
 </>}

 {/* ── WEBHOOKS ── */}
 {view==='webhooks'&&<>
 <div style={{marginBottom:20}}>
 <div style={{fontSize:10,color:'#00FF88',letterSpacing:3,marginBottom:4}}>THRESHOLD WEBHOOKS</div>
 <div style={{fontSize:20,fontWeight:800,color:'#F8FAFC'}}>Trigger HTTP calls on threshold</div>
 <div style={{fontSize:12,color:'#475569',marginTop:6}}>When simulator crosses a threshold, it hits your webhook instantly.</div>
 </div>
 {!selected?<div style={{...card,textAlign:'center' as const,padding:32,color:'#475569',fontSize:13}}>Go to Devices and tap a device first</div>:(
 <>
 <div style={card}>
 <div style={{fontSize:10,letterSpacing:2,color:'#00FF88',marginBottom:14}}>ADD WEBHOOK FOR: {selected.name}</div>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
 <div><label style={lbl}>SENSOR NAME</label><input value={nw.sensorName} onChange={e=>setNw(w=>({...w,sensorName:e.target.value}))} placeholder="e.g. heartRate" style={inp}/></div>
 <div><label style={lbl}>CONDITION</label>
 <select value={nw.operator} onChange={e=>setNw(w=>({...w,operator:e.target.value}))}>
 {[['gt','> greater than'],['lt','< less than'],['gte','>= at least'],['lte','<= at most'],['eq','= equals']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
 </select>
 </div>
 </div>
 <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:12,marginBottom:12}}>
 <div><label style={lbl}>VALUE</label><input type="number" value={nw.value} onChange={e=>setNw(w=>({...w,value:+e.target.value}))} style={inp}/></div>
 <div><label style={lbl}>WEBHOOK URL</label><input value={nw.webhookUrl} onChange={e=>setNw(w=>({...w,webhookUrl:e.target.value}))} placeholder="https://your-api.com/alert" style={inp}/></div>
 </div>
 <div style={{display:'flex',gap:8,marginBottom:14}}>{['POST','GET'].map(m=><button key={m} onClick={()=>setNw(w=>({...w,method:m}))} style={btn(nw.method===m)}>{m}</button>)}</div>
 <button onClick={createWebhook} disabled={!nw.sensorName||!nw.webhookUrl} style={{...btn(true),opacity:(!nw.sensorName||!nw.webhookUrl)?0.4:1}}>ADD WEBHOOK →</button>
 </div>
 {webhooks.length>0&&<div style={card}>
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
 </div>}
 </>
 )}
 </>}

 </div>
 </div>

 {/* BOTTOM NAV - mobile only */}
 <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#0D1117',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',zIndex:100}}>
 {[['devices',' ','Devices'],['new','+','New'],['scenarios',' ','Scripts'],['webhooks',' ','Hooks']].map(([id,icon,label])=>(
 <button key={id} onClick={()=>nav(id)} style={{flex:1,background:'transparent',border:'none',borderTop:`2px solid ${view===id?'#00FF88':'transparent'}`,color:view===id?'#00FF88':'#475569',padding:'10px 4px',fontSize:10,cursor:'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column' as const,alignItems:'center',gap:3}}>
 <span style={{fontSize:16}}>{icon}</span>
 <span style={{letterSpacing:1,fontSize:9}}>{label}</span>
 </button>
 ))}
 </div>

 {/* Desktop sidebar CSS */}
 <style>{`
 @media(min-width:768px){
 .desktop-sidebar{display:flex!important}
 nav+div+div+div>div:last-child{padding-bottom:28px!important}
 }
 `}</style>
</div>


);
}