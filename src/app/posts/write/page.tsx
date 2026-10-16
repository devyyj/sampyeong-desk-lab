import PostForm from '@/components/PostForm';

export default function PostWritePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">새 게시글 작성</h1>
          <p className="text-sm text-muted-foreground mt-1">보드게임 후기나 팀원들과 나누고 싶은 이야기를 자유롭게 작성해주세요.</p>
        </div>
        <PostForm mode="create" />
      </div>
    </div>
  );
}
