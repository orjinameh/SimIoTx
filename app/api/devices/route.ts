import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/options';
import { connectDB, Device, User } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET all devices for current user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const devices = await Device.find({ userId: session.user.id }).lean();
  return NextResponse.json({ success: true, data: devices });
}

// POST create a new device
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  // Check device limit
  const user = await User.findById(session.user.id).lean() as any;
  const count = await Device.countDocuments({ userId: session.user.id });
  if (count >= user.deviceLimit) {
    return NextResponse.json({
      error: `Device limit reached. Upgrade to Pro for unlimited devices.`
    }, { status: 403 });
  }

  const body = await req.json();
  const device = await Device.create({
    ...body,
    userId: session.user.id,
    deviceId: randomUUID(),
    isRunning: false,
  });

  return NextResponse.json({ success: true, data: device }, { status: 201 });
}
