import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { connectDB, Scenario, Device } from '@/lib/db';
import { startSimulator, stopSimulator, isRunning } from '@/lib/simulator';

// GET all scenarios for user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const scenarios = await Scenario.find({ userId: session.user.id }).lean();
  return NextResponse.json({ success: true, data: scenarios });
}

// POST create scenario
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const body = await req.json();

  // Validate device belongs to user
  const device = await Device.findOne({ deviceId: body.deviceId, userId: session.user.id });
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const scenario = await Scenario.create({ ...body, userId: session.user.id });
  return NextResponse.json({ success: true, data: scenario }, { status: 201 });
}
