import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import PostForm from './PostForm';
import { createPost, updatePost, requestPostImageUploads } from '@/app/actions/post';

const uploadToSignedUrl = vi.fn();
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ storage: { from: (bucket: string) => ({ uploadToSignedUrl: (...a: unknown[]) => uploadToSignedUrl(bucket, ...a) }) } }),
}));
vi.mock('@/app/actions/post', () => ({
  createPost: vi.fn(async () => null),
  updatePost: vi.fn(async () => null),
  requestPostImageUploads: vi.fn(),
}));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const png = (name: string, size = 100) => {
  const file = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};
const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('사진 첨부 (선택)'), { target: { files } });
const submitted = () => {
  const call = vi.mocked(createPost).mock.calls[0] ?? vi.mocked(updatePost).mock.calls[0];
  return call[1] as FormData;
};

describe('PostForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn((f: Blob) => `blob:${(f as File).name}`);
    URL.revokeObjectURL = vi.fn();
    uploadToSignedUrl.mockResolvedValue({ data: {}, error: null });
    vi.mocked(requestPostImageUploads).mockImplementation(async (files) => ({
      uploads: files.map((_, i) => ({ path: `me/${i}.png`, token: `t${i}` })),
    }));
  });

  it('여러 장을 고를 수 있고, 고르는 즉시 미리보기를 보여주며 빼기도 된다', () => {
    render(<PostForm mode="create" />);
    const input = screen.getByLabelText('사진 첨부 (선택)');
    expect(input).toHaveAttribute('multiple');
    expect(input).toHaveAttribute('accept', 'image/*');

    pick([png('a.png'), png('b.png')]);
    expect(screen.getByRole('img', { name: '새 사진 1' })).toHaveAttribute('src', 'blob:a.png');
    expect(screen.getByRole('img', { name: '새 사진 2' })).toHaveAttribute('src', 'blob:b.png');
    fireEvent.click(screen.getByRole('button', { name: '새 사진 1 빼기' }));
    expect(screen.getByRole('img', { name: '새 사진 1' })).toHaveAttribute('src', 'blob:b.png');
    expect(screen.queryByRole('img', { name: '새 사진 2' })).toBeNull();
    expect(screen.getByText('사진 1 / 10장')).toBeInTheDocument();
  });

  it('11장 이상·10MB 초과·이미지 아닌 파일은 고르는 단계에서 막는다', () => {
    render(<PostForm mode="create" />);
    pick(Array.from({ length: 11 }, (_, i) => png(`${i}.png`)));
    expect(screen.getByText('사진은 최대 10장까지 올릴 수 있습니다.')).toBeInTheDocument();
    expect(screen.queryAllByRole('img')).toHaveLength(0);

    pick([png('big.png', 10 * 1024 * 1024 + 1)]);
    expect(screen.getByText('사진은 한 장에 10MB 이하여야 합니다.')).toBeInTheDocument();
    pick([new File(['x'], 'doc.pdf', { type: 'application/pdf' })]);
    expect(screen.getByText('이미지 파일만 올릴 수 있습니다.')).toBeInTheDocument();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('제출하면 서명 토큰을 받아 Storage에 직접 올린 뒤, 경로만 순서대로 createPost에 보낸다', async () => {
    render(<PostForm mode="create" />);
    fireEvent.change(screen.getByLabelText(/내용/), { target: { value: '사진 글' } });
    const a = png('a.png', 10);
    const b = png('b.png', 20);
    pick([a, b]);
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));

    await waitFor(() => expect(createPost).toHaveBeenCalled());
    expect(requestPostImageUploads).toHaveBeenCalledWith([{ type: 'image/png', size: 10 }, { type: 'image/png', size: 20 }], 0);
    expect(uploadToSignedUrl).toHaveBeenCalledWith('activity_photos', 'me/0.png', 't0', a);
    expect(uploadToSignedUrl).toHaveBeenCalledWith('activity_photos', 'me/1.png', 't1', b);
    expect(submitted().get('content')).toBe('사진 글');
    expect(submitted().getAll('imagePaths')).toEqual(['me/0.png', 'me/1.png']);
  });

  it('내용 칸은 보이는 라벨이 있는 입력 상자이고, 플레이스홀더는 입력 요청 문구다', () => {
    render(<PostForm mode="create" />);
    const content = screen.getByRole('textbox', { name: '내용' });
    expect(content).toHaveAttribute('placeholder', '내용을 입력하세요');
    // 라벨이 화면에 보인다(스크린리더 전용 sr-only가 아님).
    expect(screen.getByText('내용', { selector: 'label' })).not.toHaveClass('sr-only');
    expect(content.className).toContain('bg-muted');
  });

  it('사진이 없으면 업로드 없이 바로 저장한다', async () => {
    render(<PostForm mode="create" />);
    fireEvent.change(screen.getByLabelText(/내용/), { target: { value: '글만' } });
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await waitFor(() => expect(createPost).toHaveBeenCalled());
    expect(requestPostImageUploads).not.toHaveBeenCalled();
    expect(submitted().getAll('imagePaths')).toEqual([]);
  });

  it('업로드가 일부 실패하면 저장하지 않고 실패한 파일 이름을 알려준다', async () => {
    uploadToSignedUrl.mockResolvedValueOnce({ data: {}, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    render(<PostForm mode="create" />);
    fireEvent.change(screen.getByLabelText(/내용/), { target: { value: '글' } });
    pick([png('ok.png'), png('fail.png')]);
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    expect(await screen.findByText('사진을 올리지 못했습니다(fail.png). 다시 시도해주세요.')).toBeInTheDocument();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('토큰 발급이 거부되면 그 이유를 보여준다', async () => {
    vi.mocked(requestPostImageUploads).mockResolvedValueOnce({ error: '로그인이 필요합니다.' });
    render(<PostForm mode="create" />);
    fireEvent.change(screen.getByLabelText(/내용/), { target: { value: '글' } });
    pick([png('a.png')]);
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    expect(await screen.findByText('로그인이 필요합니다.')).toBeInTheDocument();
    expect(uploadToSignedUrl).not.toHaveBeenCalled();
  });

  describe('선택 정보(태그·모임 날짜·시즌)', () => {
    const SEASONS = [
      { id: 4, name: '시즌 4' },
      { id: 5, name: '시즌 5' },
    ];
    const tagBox = () => screen.getByRole('textbox', { name: /태그/ });
    const tagList = () =>
      screen.queryAllByRole('button', { name: /^#.+ 빼기$/ }).map((b) => b.getAttribute('aria-label')!.replace(/ 빼기$/, ''));

    it('양식은 하나다: 종류 전환·제목 칸이 없다', () => {
      render(<PostForm mode="create" seasons={SEASONS} />);
      expect(screen.queryByRole('radiogroup', { name: '글 종류' })).toBeNull();
      expect(screen.queryByLabelText('제목')).toBeNull();
    });

    it('태그는 Enter·쉼표로 추가하고, 예시를 눌러도 추가된다. ×로 뺀다', () => {
      render(<PostForm mode="create" seasons={SEASONS} />);
      expect(tagBox()).toHaveAttribute('placeholder', '태그를 입력하세요');
      fireEvent.change(tagBox(), { target: { value: '#스컬킹' } });
      fireEvent.keyDown(tagBox(), { key: 'Enter' });
      fireEvent.change(tagBox(), { target: { value: '점심,' } });
      fireEvent.click(screen.getByRole('button', { name: '#방탈출' }));
      expect(tagList()).toEqual(['#스컬킹', '#점심', '#방탈출']);
      // 이미 단 예시는 다시 누를 수 없다.
      expect(screen.getByRole('button', { name: '#방탈출' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: '#점심 빼기' }));
      expect(tagList()).toEqual(['#스컬킹', '#방탈출']);
    });

    it('태그는 5개까지만', () => {
      render(<PostForm mode="create" seasons={SEASONS} />);
      for (const t of ['a', 'b', 'c', 'd', 'e']) {
        fireEvent.change(tagBox(), { target: { value: t } });
        fireEvent.keyDown(tagBox(), { key: 'Enter' });
      }
      expect(tagList()).toHaveLength(5);
      expect(tagBox()).toBeDisabled();
      expect(screen.getByText('5/5')).toBeInTheDocument();
    });

    it('모임 날짜·시즌은 기본값 없이 비어 있고(선택), 고른 값과 태그를 함께 보낸다', async () => {
      render(<PostForm mode="create" seasons={SEASONS} />);
      expect(screen.getByLabelText(/모임 날짜/)).toHaveValue('');
      expect(screen.getByLabelText(/모임 날짜/)).not.toBeRequired();
      expect(screen.getByLabelText(/시즌/)).toHaveValue('');
      // 최신 시즌이 위에 온다.
      expect(within(screen.getByLabelText(/시즌/)).getAllByRole('option').map((o) => o.textContent)).toEqual(['선택 안 함', '시즌 5', '시즌 4']);

      fireEvent.change(screen.getByLabelText(/내용/), { target: { value: '스컬킹 했어요' } });
      fireEvent.click(screen.getByRole('button', { name: '#점심' }));
      fireEvent.change(screen.getByLabelText(/모임 날짜/), { target: { value: '2026-10-16' } });
      fireEvent.change(screen.getByLabelText(/시즌/), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
      await waitFor(() => expect(createPost).toHaveBeenCalled());
      const fd = submitted();
      expect(fd.getAll('tags')).toEqual(['점심']);
      expect(fd.get('activityDate')).toBe('2026-10-16');
      expect(fd.get('seasonId')).toBe('5');
    });

    it('수정 화면은 같은 양식에 기존 값이 채워진다', () => {
      render(
        <PostForm
          mode="edit"
          seasons={SEASONS}
          post={{ id: 'a1', content: '제 7회 방탈출\n• 테마', images: [], tags: ['방탈출'], activityDate: '2026-07-31', seasonId: 4 }}
        />,
      );
      expect(screen.getByText('게시글 수정')).toBeInTheDocument();
      expect(tagList()).toEqual(['#방탈출']);
      expect(screen.getByLabelText(/모임 날짜/)).toHaveValue('2026-07-31');
      expect(screen.getByLabelText(/시즌/)).toHaveValue('4');
    });
  });

  describe('수정', () => {
    const post = (n: number) => ({
      id: 'p1',
      content: '원래 내용',
      images: Array.from({ length: n }, (_, i) => ({ id: `img${i}`, url: `https://x/${i}.png` })),
    });

    it('기존 사진을 보여주고, 삭제 표시한 사진 id와 새 사진 경로를 함께 보낸다', async () => {
      render(<PostForm mode="edit" post={post(2)} />);
      expect(screen.getByLabelText(/내용/)).toHaveValue('원래 내용');
      expect(screen.getByRole('img', { name: '기존 사진 1' })).toHaveAttribute('src', 'https://x/0.png');

      const remove = screen.getByRole('button', { name: '기존 사진 1 삭제' });
      fireEvent.click(remove);
      expect(remove).toHaveAttribute('aria-pressed', 'true');
      // 다시 누르면 삭제 표시가 풀린다.
      fireEvent.click(remove);
      expect(remove).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(remove);

      pick([png('new.png')]);
      fireEvent.click(screen.getByRole('button', { name: '수정완료' }));
      await waitFor(() => expect(updatePost).toHaveBeenCalled());
      // 남은 기존 사진 수(1)를 함께 보내 서버가 개수를 검사한다.
      expect(requestPostImageUploads).toHaveBeenCalledWith([{ type: 'image/png', size: 100 }], 1);
      expect(submitted().get('id')).toBe('p1');
      expect(submitted().getAll('removeImageIds')).toEqual(['img0']);
      expect(submitted().getAll('imagePaths')).toEqual(['me/0.png']);
    });

    it('남은 기존 사진 + 새 사진이 10장을 넘으면 막고, 기존 사진을 빼면 더할 수 있다', () => {
      render(<PostForm mode="edit" post={post(9)} />);
      pick([png('a.png'), png('b.png')]);
      expect(screen.getByText('사진은 최대 10장까지 올릴 수 있습니다.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '기존 사진 1 삭제' }));
      pick([png('a.png'), png('b.png')]);
      expect(within(screen.getByRole('group', { name: '새 사진' })).getAllByRole('img')).toHaveLength(2);
      expect(screen.getByText('사진 10 / 10장')).toBeInTheDocument();
    });
  });
});
