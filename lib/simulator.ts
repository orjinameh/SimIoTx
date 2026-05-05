import mqtt from 'mqtt';

// ── STATE ─────────────────────────────────────────────────────────
const running    = new Map<string, { timer: NodeJS.Timeout; client?: any }>();
const sensorState= new Map<string, Record<string, number>>();
const chaosState = new Map<string, { active: boolean; disconnected: boolean }>();
const scenarioState = new Map<string, { stepIdx: number; stepElapsed: number }>();

// ── TYPES ─────────────────────────────────────────────────────────
export interface Sensor {
  type: string; name: string; unit: string;
  min: number; max: number; drift: number; spike: boolean;
}

export interface ScenarioStep {
  durationSeconds: number;
  targetValues?: Record<string, number>;
  label?: string;
}

export interface ThresholdWebhook {
  sensorName: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
  webhookUrl: string;
  method: 'POST' | 'GET';
}

export interface DeviceConfig {
  deviceId:   string;
  userId:     string;
  protocol:   'mqtt' | 'http';
  brokerUrl:  string;
  username?:  string;
  password?:  string;
  topic?:     string;
  httpMethod?:'POST' | 'PUT';
  interval:   number;
  sensors:    Sensor[];
  // Feature flags
  chaosMode?:       boolean;
  scenarioSteps?:   ScenarioStep[];
  scenarioLoop?:    boolean;
  csvRows?:         Record<string, number>[];  // for CSV replay
  thresholdWebhooks?: ThresholdWebhook[];
  onLog:  (payload: object, status: 'sent' | 'error', error?: string) => void;
  onStop: () => void;
}

// ── VALUE GENERATION ──────────────────────────────────────────────
function driftValue(current: number, min: number, max: number, drift: number, spike: boolean, chaos: boolean): number {
  if (chaos && Math.random() < 0.08) return Math.random() < 0.5 ? min * 0.8 : max * 1.15;
  if (spike && Math.random() < 0.04) return Math.random() < 0.5 ? min * 0.85 : max * 1.1;
  const change = (Math.random() - 0.5) * drift * 2;
  return Math.max(min, Math.min(max, parseFloat((current + change).toFixed(2))));
}

function generatePayload(deviceId: string, sensors: Sensor[], config: DeviceConfig, tickIdx: number): object {
  const isChaosModeOn = config.chaosMode && chaosState.get(deviceId)?.active;

  // ── CSV REPLAY ─────────────────────────────────────────────────
  if (config.csvRows && config.csvRows.length > 0) {
    const row = config.csvRows[tickIdx % config.csvRows.length];
    return { deviceId, timestamp: new Date().toISOString(), ...row };
  }

  // ── SCENARIO SCRIPTING ─────────────────────────────────────────
  let scenarioTargets: Record<string, number> | undefined;
  if (config.scenarioSteps && config.scenarioSteps.length > 0) {
    if (!scenarioState.has(deviceId)) scenarioState.set(deviceId, { stepIdx: 0, stepElapsed: 0 });
    const ss = scenarioState.get(deviceId)!;
    const step = config.scenarioSteps[ss.stepIdx];
    if (step) {
      scenarioTargets = step.targetValues;
      ss.stepElapsed += config.interval / 1000;
      if (ss.stepElapsed >= step.durationSeconds) {
        ss.stepElapsed = 0;
        ss.stepIdx++;
        if (ss.stepIdx >= config.scenarioSteps.length) {
          if (config.scenarioLoop) ss.stepIdx = 0;
          else ss.stepIdx = config.scenarioSteps.length - 1;
        }
      }
    }
  }

  // ── INIT STATE ─────────────────────────────────────────────────
  if (!sensorState.has(deviceId)) {
    const init: Record<string, number> = {};
    sensors.forEach(s => { init[s.name] = parseFloat(((s.min + s.max) / 2).toFixed(2)); });
    sensorState.set(deviceId, init);
  }

  const state = sensorState.get(deviceId)!;
  const payload: Record<string, any> = { deviceId, timestamp: new Date().toISOString() };

  sensors.forEach(s => {
    if (scenarioTargets && scenarioTargets[s.name] !== undefined) {
      // Gradually move toward scenario target
      const target = scenarioTargets[s.name];
      const diff = target - state[s.name];
      const step = diff * 0.15 + (Math.random() - 0.5) * s.drift;
      state[s.name] = parseFloat((state[s.name] + step).toFixed(2));
    } else {
      state[s.name] = driftValue(state[s.name], s.min, s.max, s.drift, s.spike, !!isChaosModeOn);
    }
    payload[s.name] = state[s.name];
  });

  return payload;
}

// ── THRESHOLD WEBHOOKS ────────────────────────────────────────────
async function checkThresholds(payload: any, webhooks: ThresholdWebhook[]) {
  for (const wh of webhooks) {
    const val = payload[wh.sensorName];
    if (val === undefined) continue;
    let triggered = false;
    if (wh.operator === 'gt')  triggered = val > wh.value;
    if (wh.operator === 'lt')  triggered = val < wh.value;
    if (wh.operator === 'gte') triggered = val >= wh.value;
    if (wh.operator === 'lte') triggered = val <= wh.value;
    if (wh.operator === 'eq')  triggered = val === wh.value;
    if (triggered) {
      try {
        await fetch(wh.webhookUrl, {
          method: wh.method,
          headers: { 'Content-Type': 'application/json' },
          body: wh.method === 'POST' ? JSON.stringify({ trigger: wh, payload, timestamp: new Date().toISOString() }) : undefined,
        });
      } catch (_) {}
    }
  }
}

// ── CHAOS MODE ────────────────────────────────────────────────────
function initChaos(deviceId: string) {
  chaosState.set(deviceId, { active: false, disconnected: false });
  // Randomly toggle chaos active state
  setInterval(() => {
    const cs = chaosState.get(deviceId);
    if (!cs) return;
    cs.active = Math.random() < 0.3; // 30% chance chaos is active each check
  }, 8000);
}

// ── MULTI-DEVICE ORCHESTRATION ────────────────────────────────────
export async function startMany(configs: DeviceConfig[]): Promise<void> {
  await Promise.all(configs.map(c => startSimulator(c)));
}

export function stopMany(deviceIds: string[]): void {
  deviceIds.forEach(id => stopSimulator(id));
}

// ── START SIMULATOR ───────────────────────────────────────────────
export async function startSimulator(config: DeviceConfig): Promise<void> {
  if (running.has(config.deviceId)) stopSimulator(config.deviceId);
  if (config.chaosMode) initChaos(config.deviceId);
  if (config.protocol === 'mqtt') await startMQTT(config);
  else startHTTP(config);
}

async function startMQTT(config: DeviceConfig): Promise<void> {
  const client = mqtt.connect(config.brokerUrl, {
    clientId: `simiotx-${config.deviceId}-${Date.now()}`,
    username: config.username,
    password: config.password,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  await new Promise<void>((resolve, reject) => {
    client.on('connect', () => resolve());
    client.on('error', (err: any) => reject(err));
    setTimeout(() => reject(new Error('Connection timeout')), 12000);
  });

  let tickIdx = 0;
  const timer = setInterval(async () => {
    // Chaos disconnection
    const cs = chaosState.get(config.deviceId);
    if (cs?.disconnected) return;
    if (config.chaosMode && Math.random() < 0.05) {
      cs && (cs.disconnected = true);
      setTimeout(() => { cs && (cs.disconnected = false); }, Math.random() * 5000 + 1000);
      config.onLog({ deviceId: config.deviceId, event: 'CHAOS_DISCONNECT' }, 'error', 'Chaos: simulated disconnect');
      return;
    }

    const payload = generatePayload(config.deviceId, config.sensors, config, tickIdx++);
    const topic = config.topic || `simiotx/${config.deviceId}/data`;

    if (config.thresholdWebhooks?.length) await checkThresholds(payload, config.thresholdWebhooks);

    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err: any) => {
      if (err) config.onLog(payload, 'error', err.message);
      else config.onLog(payload, 'sent');
    });
  }, config.interval);

  running.set(config.deviceId, { timer, client });
}

function startHTTP(config: DeviceConfig): void {
  let tickIdx = 0;
  const timer = setInterval(async () => {
    const payload = generatePayload(config.deviceId, config.sensors, config, tickIdx++);
    if (config.thresholdWebhooks?.length) await checkThresholds(payload, config.thresholdWebhooks);
    try {
      const res = await fetch(config.brokerUrl, {
        method: config.httpMethod || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.username && { 'Authorization': `Bearer ${config.username}` }),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      config.onLog(payload, 'sent');
    } catch (err: any) {
      config.onLog(payload, 'error', err.message);
    }
  }, config.interval);

  running.set(config.deviceId, { timer });
}

// ── STOP ──────────────────────────────────────────────────────────
export function stopSimulator(deviceId: string): void {
  const sim = running.get(deviceId);
  if (!sim) return;
  clearInterval(sim.timer);
  if (sim.client) sim.client.end(true);
  running.delete(deviceId);
  sensorState.delete(deviceId);
  chaosState.delete(deviceId);
  scenarioState.delete(deviceId);
}

export function isRunning(deviceId: string): boolean { return running.has(deviceId); }
export function getRunningCount(): number { return running.size; }
export function getAllRunning(): string[] { return Array.from(running.keys()); }

// ── CSV PARSER ────────────────────────────────────────────────────
export function parseCSV(csvText: string): Record<string, number>[] {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row: Record<string, number> = {};
    headers.forEach((h, i) => { row[h] = parseFloat(vals[i]) || 0; });
    return row;
  });
}

// ── SENSOR PRESETS ────────────────────────────────────────────────
export const SENSOR_PRESETS: Record<string, Sensor[]> = {
  medical: [
    { type: 'heartRate',   name: 'heartRate',    unit: 'bpm',         min: 55,  max: 130, drift: 3,    spike: true  },
    { type: 'spo2',        name: 'spo2',         unit: '%',           min: 88,  max: 100, drift: 1,    spike: true  },
    { type: 'temperature', name: 'temperature',  unit: '°C',          min: 35,  max: 40,  drift: 0.1,  spike: false },
    { type: 'respRate',    name: 'respRate',      unit: 'breaths/min', min: 10,  max: 30,  drift: 1,    spike: false },
    { type: 'systolic',    name: 'systolic',      unit: 'mmHg',        min: 80,  max: 180, drift: 3,    spike: true  },
    { type: 'diastolic',   name: 'diastolic',     unit: 'mmHg',        min: 50,  max: 110, drift: 2,    spike: false },
  ],
  weather: [
    { type: 'temperature', name: 'temperature',  unit: '°C',          min: 15,  max: 45,  drift: 0.5,  spike: false },
    { type: 'humidity',    name: 'humidity',      unit: '%',           min: 20,  max: 95,  drift: 1,    spike: false },
    { type: 'pressure',    name: 'pressure',      unit: 'hPa',         min: 990, max: 1030,drift: 0.5,  spike: false },
  ],
  industrial: [
    { type: 'voltage',     name: 'voltage',       unit: 'V',           min: 210, max: 250, drift: 2,    spike: true  },
    { type: 'current',     name: 'current',       unit: 'A',           min: 0,   max: 20,  drift: 1,    spike: true  },
    { type: 'temperature', name: 'temperature',   unit: '°C',          min: 20,  max: 90,  drift: 1,    spike: false },
    { type: 'vibration',   name: 'vibration',     unit: 'Hz',          min: 0,   max: 100, drift: 5,    spike: true  },
  ],
  gps: [
    { type: 'latitude',    name: 'latitude',      unit: '°',           min: 6.4, max: 6.6, drift: 0.001,spike: false },
    { type: 'longitude',   name: 'longitude',     unit: '°',           min: 3.3, max: 3.5, drift: 0.001,spike: false },
    { type: 'speed',       name: 'speed',         unit: 'km/h',        min: 0,   max: 120, drift: 5,    spike: false },
    { type: 'altitude',    name: 'altitude',      unit: 'm',           min: 10,  max: 200, drift: 1,    spike: false },
  ],
  agriculture: [
    { type: 'soilMoisture',name: 'soilMoisture',  unit: '%',           min: 10,  max: 90,  drift: 0.5,  spike: false },
    { type: 'temperature', name: 'temperature',   unit: '°C',          min: 15,  max: 45,  drift: 0.3,  spike: false },
    { type: 'light',       name: 'lightIntensity',unit: 'lux',         min: 0,   max: 100000,drift: 500, spike: false },
    { type: 'ph',          name: 'soilPH',        unit: 'pH',          min: 4,   max: 8,   drift: 0.05, spike: false },
  ],
};

// ── SCENARIO PRESETS ──────────────────────────────────────────────
export const SCENARIO_PRESETS: Record<string, ScenarioStep[]> = {
  'Patient Deterioration': [
    { durationSeconds: 60,  label: 'Stable',      targetValues: { heartRate: 75,  spo2: 98, respRate: 16, systolic: 120 } },
    { durationSeconds: 120, label: 'Early decline',targetValues: { heartRate: 95,  spo2: 94, respRate: 22, systolic: 105 } },
    { durationSeconds: 120, label: 'Deteriorating',targetValues: { heartRate: 118, spo2: 90, respRate: 28, systolic: 92  } },
    { durationSeconds: 60,  label: 'Critical',     targetValues: { heartRate: 135, spo2: 85, respRate: 32, systolic: 85  } },
  ],
  'Temperature Spike': [
    { durationSeconds: 60,  label: 'Normal',  targetValues: { temperature: 36.6 } },
    { durationSeconds: 90,  label: 'Rising',  targetValues: { temperature: 38.5 } },
    { durationSeconds: 120, label: 'Fever',   targetValues: { temperature: 40.1 } },
    { durationSeconds: 90,  label: 'Falling', targetValues: { temperature: 37.2 } },
  ],
  'Power Fluctuation': [
    { durationSeconds: 30,  label: 'Normal',   targetValues: { voltage: 230, current: 5  } },
    { durationSeconds: 30,  label: 'Surge',    targetValues: { voltage: 248, current: 18 } },
    { durationSeconds: 30,  label: 'Drop',     targetValues: { voltage: 215, current: 2  } },
    { durationSeconds: 60,  label: 'Recovery', targetValues: { voltage: 230, current: 5  } },
  ],
};
