import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { parseCSV } from '@/lib/simulator';

// POST upload CSV and parse it into rows
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const text = await file.text();
  try {
    const rows = parseCSV(text);
    return NextResponse.json({
      success: true,
      data: { rows, rowCount: rows.length, columns: Object.keys(rows[0] || {}) }
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
  }
}
