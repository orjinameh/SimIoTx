import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;
let cached = (global as any).mongoose || { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then(m => m);
  }
  cached.conn = await cached.promise;
  (global as any).mongoose = cached;
  return cached.conn;
}

// ── USER ──────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true },
  password:     { type: String, required: true },
  name:         { type: String },
  plan:         { type: String, enum: ['free', 'pro', 'team'], default: 'free' },
  deviceLimit:  { type: Number, default: 1 },
  msgLimit:     { type: Number, default: 100 }, // per day
  coinbaseCustomerId: { type: String },
}, { timestamps: true });

// ── DEVICE ────────────────────────────────────────────────────────
const SensorSchema = new mongoose.Schema({
  type:    { type: String }, // heartRate, temperature, humidity, gps, custom
  name:    { type: String },
  unit:    { type: String },
  min:     { type: Number },
  max:     { type: Number },
  drift:   { type: Number, default: 2 }, // how much it changes per tick
  spike:   { type: Boolean, default: false }, // randomly spike value
}, { _id: false });

const DeviceSchema = new mongoose.Schema({
  userId:      { type: String, required: true, index: true },
  name:        { type: String, required: true },
  deviceId:    { type: String, required: true, unique: true },
  // Connection
  protocol:    { type: String, enum: ['mqtt', 'http'], default: 'mqtt' },
  brokerUrl:   { type: String }, // mqtt broker or http endpoint
  username:    { type: String },
  password:    { type: String },
  topic:       { type: String }, // mqtt topic
  httpMethod:  { type: String, enum: ['POST', 'PUT'], default: 'POST' },
  // Simulation
  interval:    { type: Number, default: 2000 }, // ms between messages
  sensors:     [SensorSchema],
  isRunning:   { type: Boolean, default: false },
  msgCount:    { type: Number, default: 0 },
  lastSent:    { type: Date },
}, { timestamps: true });

// ── LOG ───────────────────────────────────────────────────────────
const LogSchema = new mongoose.Schema({
  deviceId:  { type: String, required: true, index: true },
  userId:    { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  payload:   { type: Object },
  status:    { type: String, enum: ['sent', 'error'], default: 'sent' },
  error:     { type: String },
}, { timestamps: false });

// ── SCENARIO ──────────────────────────────────────────────────────
const ScenarioStepSchema = new mongoose.Schema({
  durationSeconds: { type: Number, required: true },
  targetValues:    { type: Object }, // { sensorName: targetValue }
  label:           { type: String },
}, { _id: false });

const ScenarioSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  deviceId:  { type: String, required: true },
  name:      { type: String, required: true },
  steps:     [ScenarioStepSchema],
  loop:      { type: Boolean, default: false },
  isRunning: { type: Boolean, default: false },
}, { timestamps: true });

// ── SHARE LINK ────────────────────────────────────────────────────
const ShareSchema = new mongoose.Schema({
  userId:     { type: String, required: true },
  deviceId:   { type: String, required: true },
  token:      { type: String, required: true, unique: true },
  expiresAt:  { type: Date },
  useCount:   { type: Number, default: 0 },
}, { timestamps: true });

// ── THRESHOLD WEBHOOK ─────────────────────────────────────────────
const ThresholdWebhookSchema = new mongoose.Schema({
  userId:     { type: String, required: true },
  deviceId:   { type: String, required: true },
  sensorName: { type: String, required: true },
  operator:   { type: String, enum: ['gt', 'lt', 'gte', 'lte', 'eq'], required: true },
  value:      { type: Number, required: true },
  webhookUrl: { type: String, required: true },
  method:     { type: String, enum: ['POST', 'GET'], default: 'POST' },
  active:     { type: Boolean, default: true },
  lastTriggered: { type: Date },
  triggerCount:  { type: Number, default: 0 },
}, { timestamps: true });

export const User      = mongoose.models.User      || mongoose.model('User', UserSchema);
export const Device    = mongoose.models.Device    || mongoose.model('Device', DeviceSchema);
export const Log       = mongoose.models.Log       || mongoose.model('Log', LogSchema);
export const Scenario  = mongoose.models.Scenario  || mongoose.model('Scenario', ScenarioSchema);
export const ShareLink = mongoose.models.ShareLink || mongoose.model('ShareLink', ShareSchema);
export const ThresholdWebhook = mongoose.models.ThresholdWebhook || mongoose.model('ThresholdWebhook', ThresholdWebhookSchema);
