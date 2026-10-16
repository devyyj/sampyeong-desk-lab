import PostForm from '@/components/PostForm';

/** 새 게시글 작성(전체 화면 작성 모드). 상단 바·제출 버튼은 PostForm이 그린다. */
export default function PostWritePage() {
  return <PostForm mode="create" />;
}
