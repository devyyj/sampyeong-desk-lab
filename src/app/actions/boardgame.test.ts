import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addBoardGame, updateBoardGame } from './boardgame';
import * as session from '@/lib/session';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('boardgame server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addBoardGame', () => {
    it('returns error if not logged in', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce(null);
      const formData = new FormData();
      const result = await addBoardGame(null, formData);
      expect(result).toEqual({ error: '로그인이 필요합니다.' });
    });

    it('returns error if name is missing', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: '1', username: 'test', isAdmin: false, mustChangePin: false, expiresAt: new Date() });
      const formData = new FormData();
      const result = await addBoardGame(null, formData);
      expect(result).toEqual({ error: '보드게임 이름을 입력해주세요.' });
    });

    it('썸네일 파일이 함께 와도 업로드하지 않고 정보만 저장한다(목록에서 이미지를 쓰지 않음)', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: 'u1', username: 'test' } as never);
      const formData = new FormData();
      formData.set('name', '스플렌더');
      formData.set('recommendedPlayers', '2~4명');
      formData.set('playTime', '30분');
      formData.set('image', new File(['x'], 'a.png', { type: 'image/png' }));
      await addBoardGame(null, formData);
      expect((db as unknown as { values: unknown }).values).toHaveBeenCalledWith({
        name: '스플렌더', category: null, recommendedPlayers: '2~4명', playTime: '30분', inSharedCabinet: false, addedById: 'u1',
      });
    });

    it('공용 보관함 체크박스를 켜면 공용 보관함 게임으로 저장한다', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: 'u1', username: 'test' } as never);
      const formData = new FormData();
      formData.set('name', '스컬킹');
      formData.set('inSharedCabinet', 'on');
      await addBoardGame(null, formData);
      expect((db as unknown as { values: unknown }).values).toHaveBeenCalledWith(expect.objectContaining({ inSharedCabinet: true }));
    });
  });

  describe('카테고리', () => {
    const form = (o: Record<string, string>) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(o)) fd.set(k, v);
      return fd;
    };
    const values = () => (db as unknown as { values: ReturnType<typeof vi.fn> }).values;

    it('등록할 때 카테고리를 앞뒤·중복 공백을 정리해 저장한다(같은 분류가 표기 차이로 갈라지지 않게)', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: 'u1' } as never);
      await addBoardGame(null, form({ name: '스컬킹', category: '  트릭   테이킹 ' }));
      expect(values()).toHaveBeenCalledWith(expect.objectContaining({ category: '트릭 테이킹' }));
    });

    it('비우면 미분류(null)', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: 'u1' } as never);
      await addBoardGame(null, form({ name: '스컬킹', category: '   ' }));
      expect(values()).toHaveBeenCalledWith(expect.objectContaining({ category: null }));
    });

    it('50자가 넘으면 저장하지 않고 오류(DB varchar(50))', async () => {
      vi.mocked(session.getSession).mockResolvedValue({ userId: 'u1' } as never);
      expect(await addBoardGame(null, form({ name: '스컬킹', category: '가'.repeat(51) }))).toEqual({ error: '카테고리는 50자 이하로 입력해주세요.' });
      expect(await updateBoardGame(null, form({ id: 'g1', name: '스컬킹', category: '가'.repeat(51) }))).toEqual({ error: '카테고리는 50자 이하로 입력해주세요.' });
      expect(values()).not.toHaveBeenCalled();
    });

    it('수정할 때도 카테고리를 저장한다', async () => {
      vi.mocked(session.getSession).mockResolvedValueOnce({ userId: 'u1' } as never);
      await updateBoardGame(null, form({ id: 'g1', name: '스컬킹', category: '전략' }));
      expect((db as unknown as { set: ReturnType<typeof vi.fn> }).set).toHaveBeenCalledWith(expect.objectContaining({ category: '전략' }));
    });
  });

  describe('updateBoardGame', () => {
    const form = (o: Record<string, string>) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(o)) fd.set(k, v);
      return fd;
    };

    it('보관 상태(보관 중·플레이 중·대여 중) 대신 공용 보관함 여부만 저장한다', async () => {
      vi.mocked(session.getSession).mockResolvedValue({ userId: 'u1' } as never);
      // 예전 폼처럼 status가 섞여 와도 무시한다.
      await updateBoardGame(null, form({ id: 'g1', name: '스컬킹', recommendedPlayers: '', playTime: '', status: 'BORROWED', inSharedCabinet: 'on' }));
      const set = (db as unknown as { set: ReturnType<typeof vi.fn> }).set;
      expect(set).toHaveBeenCalledWith({ name: '스컬킹', category: null, recommendedPlayers: '', playTime: '', inSharedCabinet: true, updatedAt: expect.any(Date) });

      // 체크를 끄면(체크박스는 꺼지면 값이 아예 오지 않는다) 공용 보관함에서 뺀다.
      await updateBoardGame(null, form({ id: 'g1', name: '스컬킹' }));
      expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ inSharedCabinet: false }));
    });
  });
});
