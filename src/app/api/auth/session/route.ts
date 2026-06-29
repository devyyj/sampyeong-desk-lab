import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return Response.json({
    user: {
      id: 'test-user-id',
      email: 'user1@sdl.com',
      user_metadata: {
        nickname: 'user1',
        real_name: '홍길동',
        department: '연구개발부',
        role: 'admin',
      },
    },
  });
}
