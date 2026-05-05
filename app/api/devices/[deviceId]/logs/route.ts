import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { connectDB, Log } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const logs = await Log.find({
    deviceId: params.deviceId,
    userId: session.user.id,
  }).sort({ timestamp: -1 }).limit(50).lean();

  return NextResponse.json({ success: true, data: logs });
}
