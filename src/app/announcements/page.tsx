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
    nickname: string;
    role: string;
  };
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = React.useState<Post[]>([]);
  const [newContent, setNewContent] = React.useState('');
  const [error, setError] = React.useState('');
  const [currentUser, setCurrentUser] = React.useState({
    id: '',
    nickname: '',
    role: '', 
  });

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/mock-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'announcements' }),
      });
      const data = await res.json();
      if (data.posts) {
        setAnnouncements(data.posts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        setCurrentUser({
          id: data.user.id,
          nickname: data.user.user_metadata?.nickname || 'anonymous',
          role: data.user.user_metadata?.role || 'user',
        });
      } else {
        setCurrentUser({
          id: 'anonymous',
          nickname: 'anonymous',
          role: 'user',
        });
      }
    } catch (e) {
      // fallback
    }
  };

  React.useEffect(() => {
    fetchSession();
    fetchAnnouncements();
  }, []);

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // TC-06-01: role === 'admin' 체크
    if (currentUser.role !== 'admin') {
      setError('공지사항은 관리자만 작성할 수 있습니다.');
      return;
    }

    if (!newContent.trim()) return;

    const newPost: Post = {
      id: `announce-${Date.now()}`,
      userId: currentUser.id,
      content: newContent,
      imageUrls: null,
      isAnnouncement: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likesCount: 0,
      liked: false,
      user: {
        realName: '관리자',
        department: '연구개발부',
        nickname: currentUser.nickname,
        role: currentUser.role,
      },
    };

    setAnnouncements(prev => [newPost, ...prev]);
    setNewContent('');
  };

  const handleDeleteAnnouncement = (postId: string) => {
    if (currentUser.role !== 'admin') {
      setError('공지사항 삭제 권한이 없습니다.');
      return;
    }
    setAnnouncements(prev => prev.filter(a => a.id !== postId));
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-[#18181b] dark:text-[#f4f4f5] pb-8 font-sans">

      <main className="max-w-md mx-auto px-4 mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold flex items-center gap-1.5">
              <span>연구소 공지사항</span>
              <span className="text-[9px] bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 px-1 rounded font-semibold">
                중요
              </span>
            </h2>
            <p className="text-[11px] text-[#71717a] dark:text-[#a1a1aa]">중요 정책 사항들을 공유합니다.</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-500 text-[11px] p-2.5 rounded text-center">
            {error}
          </div>
        )}

        {/* Admin announcement creation tool */}
        {currentUser.role === 'admin' && (
          <form onSubmit={handleCreateAnnouncement} className="bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg p-4 space-y-3 shadow-sm">
            <textarea
              placeholder="새로운 공지사항을 작성하세요..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full bg-transparent border-0 resize-none text-[12px] focus:outline-none placeholder-[#a1a1aa] min-h-[60px]"
            />
            <div className="flex justify-end pt-2 border-t border-[#f4f4f5] dark:border-[#1e1e21]">
              <button
                type="submit"
                className="px-3 py-1 bg-[#18181b] dark:bg-[#f4f4f5] text-white dark:text-[#18181b] rounded text-[11px] font-medium"
              >
                공지 등록
              </button>
            </div>
          </form>
        )}

        {/* Announcements List */}
        <div className="space-y-3">
          {announcements.map((post) => (
            <article key={post.id} className="bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-[10px] text-[#71717a] dark:text-[#a1a1aa] border-b border-[#f4f4f5] dark:border-[#1e1e21] pb-1.5">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-[#18181b] dark:text-[#f4f4f5]">{post.user.realName}</span>
                  <span>@{post.user.nickname}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteAnnouncement(post.id)}
                      className="text-rose-500 hover:underline"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-[#27272a] dark:text-[#e4e4e7]">
                {post.content}
              </p>
            </article>
          ))}
          {announcements.length === 0 && (
            <div className="text-center py-8 text-[#a1a1aa] text-[11px]">
              게시된 공지사항이 없습니다.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
