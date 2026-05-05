import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { connectDB, Device, ShareLink, User } from '@/lib/db';
import { v4 as uuid } from 'uuid';

// POST generate a share link for a device
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();

  const { deviceId, expiresInHours = 48 } = await req.json();
  const device = await Device.findOne({ deviceId, userId: session.user.id }).lean();
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const token = uuid().replace(/-/g, '').slice(0, 16);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const link = await ShareLink.create({
    userId: session.user.id,
    deviceId,
    token,
    expiresAt,
  });

  const shareUrl = `${process.env.NEXTAUTH_URL}/share/${token}`;
  return NextResponse.json({ success: true, data: { token, shareUrl, expiresAt } });
}

// GET redeem a share link — returns device config (no secrets)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  await connectDB();
  const link = await ShareLink.findOne({ token }).lean() as any;
  if (!link) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  if (link.expiresAt && new Date() > link.expiresAt) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 });
  }

  // Return device config without credentials
  const device = await Device.findOne({ deviceId: link.deviceId }).lean() as any;
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  await ShareLink.findByIdAndUpdate(link._id, { $inc: { useCount: 1 } });

  return NextResponse.json({
    success: true,
    data: {
      name: device.name,
      protocol: device.protocol,
      topic: device.topic,
      interval: device.interval,
      sensors: device.sensors,
      // NOTE: broker URL and credentials intentionally omitted for security
      // recipient needs to add their own broker
    }
  });
}
