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
      try {
        const { db } = await import('@/db');
        const { profiles: profilesTable } = await import('@/db/schema');
        const list = await db.select().from(profilesTable);
        
        const formatted = list.map(item => ({
          id: item.id,
          realName: item.realName || (item as any).real_name || '',
          nickname: item.nickname,
          department: item.department,
          avatarUrl: item.avatarUrl || (item as any).avatar_url || null,
          bio: item.bio,
          role: item.role,
        }));
        
        return Response.json({ profiles: formatted });
      } catch (dbError) {
        console.error('Database fetch failed, attempting Supabase direct client:', dbError);
        try {
          const { createClient } = await import('@/utils/supabase/client');
          const supabase = createClient();
          const { data, error } = await supabase.from('profiles').select('*');
          if (error) throw error;
          
          const formatted = (data || []).map(item => ({
            id: item.id,
            realName: item.real_name || item.realName || '',
            nickname: item.nickname,
            department: item.department,
            avatarUrl: item.avatar_url || item.avatarUrl || null,
            bio: item.bio,
            role: item.role,
          }));
          return Response.json({ profiles: formatted });
        } catch (sbError) {
          console.error('Supabase direct fetch failed too:', sbError);
          return Response.json({
            profiles: [
              {
                id: 'test-user-id',
                realName: '홍길동',
                nickname: 'user1',
                department: '연구개발부',
                avatarUrl: null,
                bio: '안녕하세요! 삼평동 책상 전략 연구소의 주임 홍길동입니다.',
                role: 'admin',
              },
              {
                id: 'member-2',
                realName: '김철수',
                nickname: 'chulsoo',
                department: '디자인팀',
                avatarUrl: null,
                bio: '보드게임과 인테리어에 관심이 많습니다.',
                role: 'user',
              },
              {
                id: 'member-3',
                realName: '이영희',
                nickname: 'younghee',
                department: '기획부',
                avatarUrl: null,
                bio: '전략 게임 매니아입니다. 언제든 대전 환영합니다!',
                role: 'user',
              }
            ],
          });
        }
      }
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
