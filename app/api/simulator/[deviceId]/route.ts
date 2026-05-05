import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { connectDB, Device, Log, ThresholdWebhook, Scenario } from '@/lib/db';
import { startSimulator, stopSimulator, isRunning } from '@/lib/simulator';

export async function POST(req: NextRequest, { params }: { params: { deviceId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const device = await Device.findOne({ deviceId: params.deviceId, userId: session.user.id });
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const body = await req.json();
  const { action, chaosMode, scenarioId, csvRows } = body;

  if (action === 'start') {
    if (isRunning(device.deviceId)) {
      return NextResponse.json({ error: 'Already running' }, { status: 400 });
    }

    // Load threshold webhooks
    const webhooks = await ThresholdWebhook.find({ deviceId: device.deviceId, active: true }).lean() as any[];

    // Load scenario if specified
    let scenarioSteps, scenarioLoop;
    if (scenarioId) {
      const scenario = await Scenario.findOne({ _id: scenarioId, userId: session.user.id }).lean() as any;
      if (scenario) { scenarioSteps = scenario.steps; scenarioLoop = scenario.loop; }
    }

    await startSimulator({
      deviceId:   device.deviceId,
      userId:     session.user.id,
      protocol:   device.protocol,
      brokerUrl:  device.brokerUrl,
      username:   device.username,
      password:   device.password,
      topic:      device.topic,
      httpMethod: device.httpMethod,
      interval:   device.interval,
      sensors:    device.sensors,
      chaosMode:  chaosMode ?? device.chaosMode,
      scenarioSteps,
      scenarioLoop,
      csvRows: csvRows || [],
      thresholdWebhooks: webhooks,
      onLog: async (payload, status, error) => {
        await Log.create({ deviceId: device.deviceId, userId: session.user.id, payload, status, error });
        await Device.findOneAndUpdate({ deviceId: device.deviceId }, { $inc: { msgCount: 1 }, lastSent: new Date() });
        // Update webhook trigger counts
        if (status === 'sent') {
          for (const wh of webhooks) {
            const val = (payload as any)[wh.sensorName];
            if (val === undefined) continue;
            let triggered = false;
            if (wh.operator === 'gt')  triggered = val > wh.value;
            if (wh.operator === 'lt')  triggered = val < wh.value;
            if (wh.operator === 'gte') triggered = val >= wh.value;
            if (wh.operator === 'lte') triggered = val <= wh.value;
            if (wh.operator === 'eq')  triggered = val === wh.value;
            if (triggered) {
              await ThresholdWebhook.findByIdAndUpdate(wh._id, {
                $inc: { triggerCount: 1 }, lastTriggered: new Date()
              });
            }
          }
        }
      },
      onStop: async () => {
        await Device.findOneAndUpdate({ deviceId: device.deviceId }, { isRunning: false });
      },
    });

    await Device.findOneAndUpdate({ deviceId: device.deviceId }, { isRunning: true });
    return NextResponse.json({ success: true, message: 'Simulator started' });

  } else if (action === 'stop') {
    stopSimulator(device.deviceId);
    await Device.findOneAndUpdate({ deviceId: device.deviceId }, { isRunning: false });
    return NextResponse.json({ success: true, message: 'Simulator stopped' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function GET(req: NextRequest, { params }: { params: { deviceId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ deviceId: params.deviceId, running: isRunning(params.deviceId) });
}
