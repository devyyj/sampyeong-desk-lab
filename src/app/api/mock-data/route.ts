import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === 'feed') {
      return Response.json({
        posts: [],
      });
    }

    if (action === 'add-post') {
      return Response.json({ success: true });
    }

    if (action === 'like-toggle') {
      return Response.json({ success: true, liked: true });
    }

    if (action === 'comment-add') {
      return Response.json({ success: true });
    }

    if (action === 'comment-delete') {
      return Response.json({ success: true });
    }

    if (action === 'profiles') {
      return Response.json({
        profiles: [],
      });
    }

    if (action === 'announcements') {
      return Response.json({
        posts: [],
      });
    }

    if (action === 'announcement-add') {
      return Response.json({ success: true });
    }

    if (action === 'announcement-delete') {
      return Response.json({ success: true });
    }

    if (action === 'profile-update') {
      return Response.json({ success: true });
    }

    if (action === 'withdraw') {
      return Response.json({ success: true });
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
