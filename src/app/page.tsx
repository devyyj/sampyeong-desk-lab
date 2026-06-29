'use client';

import React from 'react';

interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrls: string[] | null;
  isAnnouncement: boolean;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  liked: boolean;
  user: {
    realName: string;
    department: string;
    avatarUrl: string | null;
    nickname: string;
    role: string;
  };
  comments: Comment[];
}

interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    realName: string;
    nickname: string;
  };
}

export default function FeedPage() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [content, setContent] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(5);
  const [currentUser] = React.useState({
    id: 'test-user-id',
    nickname: 'user1',
    role: 'admin',
  });

  const [commentInputs, setCommentInputs] = React.useState<Record<string, string>>({});

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/mock-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feed' }),
      });
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    fetchPosts();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const newPost: Post = {
      id: `post-${Date.now()}`,
      userId: currentUser.id,
      content,
      imageUrls: imageUrl.trim() ? [imageUrl.trim()] : null,
      isAnnouncement: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likesCount: 0,
      liked: false,
      user: {
        realName: '홍길동',
        department: '연구개발부',
        avatarUrl: null,
        nickname: currentUser.nickname,
        role: currentUser.role,
      },
      comments: [],
    };

    setPosts(prev => [newPost, ...prev]);
    setContent('');
    setImageUrl('');
  };

  const handleLikeToggle = async (postId: string) => {
    setPosts(prev =>
      prev.map(post => {
        if (post.id === postId) {
          const nextLiked = !post.liked;
          return {
            ...post,
            liked: nextLiked,
            likesCount: post.likesCount + (nextLiked ? 1 : -1),
          };
        }
        return post;
      })
    );
  };

  const handleAddComment = async (postId: string) => {
    const commentText = commentInputs[postId];
    if (!commentText || !commentText.trim()) return;

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      userId: currentUser.id,
      content: commentText,
      createdAt: new Date().toISOString(),
      user: {
        realName: '홍길동',
        nickname: currentUser.nickname,
      },
    };

    setPosts(prev =>
      prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, newComment],
          };
        }
        return post;
      })
    );

    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    setPosts(prev =>
      prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.filter(c => c.id !== commentId),
          };
        }
        return post;
      })
    );
  };

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleLogout = () => {
    window.location.href = '/login';
  };

  const filteredPosts = selectedTag
    ? posts.filter(p => p.content.includes(`#${selectedTag}`))
    : posts;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-[#18181b] dark:text-[#f4f4f5] pb-8 font-sans">

      <main className="max-w-md mx-auto px-4 mt-6 space-y-6">
        {/* Create Post Form */}
        <form onSubmit={handleCreatePost} className="bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg p-4 space-y-3 shadow-sm">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="새로운 소식을 들려주세요... (#태그)"
            className="w-full bg-transparent border-0 resize-none text-[12px] focus:outline-none placeholder-[#a1a1aa] min-h-[50px]"
          />
          <div className="flex gap-2 items-center pt-2 border-t border-[#f4f4f5] dark:border-[#1e1e21]">
            <input
              type="text"
              placeholder="이미지 링크 (선택)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="flex-1 bg-transparent border-0 text-[11px] focus:outline-none placeholder-[#a1a1aa]"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-[#18181b] dark:bg-[#f4f4f5] text-white dark:text-[#18181b] rounded text-[11px] font-medium"
            >
              게시
            </button>
          </div>
        </form>

        {/* Selected Hashtag Filter Notice */}
        {selectedTag && (
          <div className="bg-[#f4f4f5] dark:bg-[#1e1e21] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg px-3 py-2 flex items-center justify-between text-[11px]">
            <span>필터: <strong>#{selectedTag}</strong></span>
            <button
              onClick={() => setSelectedTag(null)}
              className="text-rose-500 hover:underline"
            >
              해제
            </button>
          </div>
        )}

        {/* Feed Posts */}
        <div className="space-y-4">
          {filteredPosts.slice(0, visibleCount).map((post) => {
            const words = post.content.split(' ');
            return (
              <article key={post.id} className="bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg overflow-hidden shadow-sm">
                {/* Author Info */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-[#f4f4f5] dark:border-[#1e1e21]">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-[#f4f4f5] dark:bg-[#19191c] flex items-center justify-center font-bold text-[10px] text-[#71717a] dark:text-[#a1a1aa]">
                      {post.user.realName[0]}
                    </div>
                    <div className="flex items-baseline space-x-1">
                      <span className="font-semibold text-[12px]">{post.user.realName}</span>
                      <span className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">@{post.user.nickname}</span>
                      <span className="text-[9px] text-[#a1a1aa] dark:text-[#71717a]">&middot; {post.user.department}</span>
                    </div>
                  </div>
                  {post.userId === currentUser.id && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-[10px] text-rose-500 hover:underline"
                    >
                      삭제
                    </button>
                  )}
                </div>

                {/* Post Image */}
                {post.imageUrls && post.imageUrls[0] && (
                  <div className="relative aspect-video w-full bg-[#f4f4f5] dark:bg-[#1e1e21] border-b border-[#f4f4f5] dark:border-[#1e1e21]">
                    <img
                      src={post.imageUrls[0]}
                      alt="Post"
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}

                {/* Post Content */}
                <div className="p-4 space-y-3">
                  <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-[#27272a] dark:text-[#e4e4e7]">
                    {words.map((word, i) => {
                      if (word.startsWith('#')) {
                        const tag = word.replace(/[#,.]/g, '');
                        return (
                          <span
                            key={i}
                            onClick={() => setSelectedTag(tag)}
                            className="text-[#71717a] dark:text-[#a1a1aa] hover:underline cursor-pointer font-semibold mr-1"
                          >
                            {word}
                          </span>
                        );
                      }
                      return <span key={i}>{word} </span>;
                    })}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between text-[10px] text-[#71717a] dark:text-[#a1a1aa] pt-2 border-t border-[#f4f4f5] dark:border-[#1e1e21]">
                    <button
                      onClick={() => handleLikeToggle(post.id)}
                      className={`flex items-center space-x-1 ${post.liked ? 'text-rose-500' : 'hover:text-[#18181b] dark:hover:text-[#f4f4f5]'}`}
                    >
                      <span>{post.liked ? '♥' : '♡'}</span>
                      <span>좋아요 {post.likesCount}</span>
                    </button>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Comment Section */}
                  <div className="space-y-2 pt-2 border-t border-[#f4f4f5] dark:border-[#1e1e21]">
                    <div className="space-y-1.5">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="flex justify-between items-start text-[11px] bg-[#fafafa] dark:bg-[#18181b] p-2 rounded border border-[#e4e4e7] dark:border-[#27272a]">
                          <p className="text-[#27272a] dark:text-[#e4e4e7]">
                            <strong className="text-[#18181b] dark:text-[#f4f4f5] mr-1">{comment.user.realName}</strong>
                            {comment.content}
                          </p>
                          {comment.userId === currentUser.id && (
                            <button
                              onClick={() => handleDeleteComment(post.id, comment.id)}
                              className="text-[9px] text-rose-500 hover:underline ml-2"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="댓글 남기기..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))
                        }
                        className="flex-1 bg-transparent border-0 border-b border-[#e4e4e7] dark:border-[#27272a] pb-0.5 text-[11px] focus:outline-none placeholder-[#a1a1aa]"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        className="text-[11px] font-semibold text-[#18181b] dark:text-[#f4f4f5] hover:underline"
                      >
                        등록
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Infinite Scroll / Load More Button */}
        {filteredPosts.length > visibleCount && (
          <div className="text-center">
            <button
              onClick={() => setVisibleCount(prev => prev + 5)}
              className="px-4 py-2 bg-transparent border border-[#e4e4e7] dark:border-[#27272a] text-[#71717a] dark:text-[#a1a1aa] rounded text-[11px] hover:text-[#18181b]"
            >
              더 보기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
