import { NextRequest, NextResponse } from 'next/server';
import { updateBookPinStatus } from '@/lib/db/books';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { isPinned } = body;

    if (typeof isPinned !== 'boolean') {
      return NextResponse.json({ error: 'isPinned must be a boolean' }, { status: 400 });
    }

    const updatedBook = await updateBookPinStatus(id, isPinned);

    if (!updatedBook) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, book: updatedBook });
  } catch (error) {
    console.error('Error updating pin status:', error);
    return NextResponse.json({ error: 'Failed to update pin status' }, { status: 500 });
  }
}
