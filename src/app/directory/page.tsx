'use client';

import React from 'react';

interface Profile {
  id: string;
  realName: string;
  nickname: string;
  department: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
}

export default function DirectoryPage() {
  const [profiles, setProfiles] = React.useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');

  const fetchDirectory = async () => {
    try {
      const res = await fetch('/api/mock-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profiles' }),
      });
      const data = await res.json();
      if (data.profiles) {
        setProfiles(data.profiles);
      }
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    fetchDirectory();
  }, []);

  // Filter profiles by realName or department
  const filteredProfiles = profiles.filter(p =>
    p.realName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-[#18181b] dark:text-[#f4f4f5] pb-8 font-sans">

      <main className="max-w-md mx-auto px-4 mt-6 space-y-4">
        <div>
          <h2 className="text-[14px] font-bold">회원 명부</h2>
          <p className="text-[11px] text-[#71717a] dark:text-[#a1a1aa]">동호회 회원 목록입니다.</p>
        </div>

        {/* Real-time search filter */}
        <div className="relative">
          <input
            type="text"
            placeholder="이름 또는 부서 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded text-[11px] focus:outline-none placeholder-[#a1a1aa]"
          />
        </div>

        {/* Directory List */}
        <div className="space-y-2">
          {filteredProfiles.map((member) => (
            <div key={member.id} className="bg-white dark:bg-[#121214] border border-[#e4e4e7] dark:border-[#27272a] rounded-lg p-3 flex items-start space-x-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-[#f4f4f5] dark:bg-[#19191c] text-[#71717a] dark:text-[#a1a1aa] font-bold flex items-center justify-center text-[11px]">
                {member.realName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-[12px] truncate">{member.realName}</span>
                  <span className="text-[10px] text-[#71717a] dark:text-[#a1a1aa] truncate">@{member.nickname}</span>
                  {member.role === 'admin' && (
                    <span className="bg-rose-500/10 text-rose-500 text-[9px] font-semibold px-1 rounded">
                      관리자
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">{member.department}</p>
                {member.bio && (
                  <p className="text-[#27272a] dark:text-[#e4e4e7] text-[11px] mt-1.5 bg-[#fafafa] dark:bg-[#18181b] p-2 rounded border border-[#e4e4e7] dark:border-[#27272a] leading-normal">
                    {member.bio}
                  </p>
                )}
              </div>
            </div>
          ))}
          {filteredProfiles.length === 0 && (
            <div className="text-center py-8 text-[#a1a1aa] text-[11px]">
              검색 조건에 맞는 연구원이 없습니다.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
