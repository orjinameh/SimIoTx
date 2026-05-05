import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { connectDB, ThresholdWebhook, Device } from '@/lib/db';

// GET all webhooks for user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const deviceId = req.nextUrl.searchParams.get('deviceId');
  const query: any = { userId: session.user.id };
  if (deviceId) query.deviceId = deviceId;
  const webhooks = await ThresholdWebhook.find(query).lean();
  return NextResponse.json({ success: true, data: webhooks });
}

// POST create threshold webhook
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const body = await req.json();

  const device = await Device.findOne({ deviceId: body.deviceId, userId: session.user.id });
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const webhook = await ThresholdWebhook.create({ ...body, userId: session.user.id });
  return NextResponse.json({ success: true, data: webhook }, { status: 201 });
}

// DELETE remove webhook
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const id = req.nextUrl.searchParams.get('id');
  await ThresholdWebhook.findOneAndDelete({ _id: id, userId: session.user.id });
  return NextResponse.json({ success: true });
}
