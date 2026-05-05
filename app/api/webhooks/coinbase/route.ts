import { NextRequest, NextResponse } from 'next/server';
import { connectDB, User } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-cc-webhook-signature');
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET!;

  // Verify webhook signature
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (hmac !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.type === 'charge:confirmed') {
    const { metadata } = event.data;
    const { userId, plan } = metadata;

    await connectDB();

    const limits = {
      pro:  { deviceLimit: 999, msgLimit: 999999 },
      team: { deviceLimit: 999, msgLimit: 999999 },
    } as any;

    await User.findByIdAndUpdate(userId, {
      plan,
      ...limits[plan],
    });

    console.log(`✅ User ${userId} upgraded to ${plan}`);
  }

  return NextResponse.json({ received: true });
}
