import Link from 'next/link';

export default function Page() {
  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-white min-h-screen relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />

      {/* Global Navigation Header (Always Accessible) */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="font-extrabold text-base sm:text-lg bg-gradient-to-r from-violet-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent truncate">
            SDL전략연구소
          </Link>
          <nav className="flex items-center space-x-3 sm:space-x-6 text-xs sm:text-sm font-semibold text-slate-300">
            <Link href="/feed" className="hover:text-white transition-colors">피드</Link>
            <Link href="/directory" className="hover:text-white transition-colors">명부</Link>
            <Link href="/announcements" className="hover:text-white transition-colors">공지</Link>
            <span className="h-4 w-px bg-slate-800 hidden sm:inline" />
            <Link href="/login" className="hover:text-white transition-colors">로그인</Link>
            <Link href="/signup" className="px-2 py-1 sm:px-3 sm:py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-[10px] sm:text-xs transition-colors shadow-md shadow-violet-500/10">회원가입</Link>
          </nav>
        </div>
      </header>

      {/* Landing Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 select-none z-10">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Logo/Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-cyan-500 rounded-3xl flex items-center justify-center shadow-xl shadow-violet-500/20 animate-pulse">
              <span className="text-3xl">🎲</span>
            </div>
          </div>

          {/* Title Section */}
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              삼책연
            </h1>
            <p className="text-slate-400 text-sm font-medium tracking-wide">
              삼평동 책상 전략 연구소 (SDL)
            </p>
          </div>

          {/* Description */}
          <p className="text-slate-300 text-sm leading-relaxed max-w-sm mx-auto">
            사내 보드게임 동아리 회원들을 위한 커뮤니티 공간입니다. 
            로그인 없이도 게시글 피드, 회원 명부 검색, 최신 공지사항을 둘러볼 수 있습니다.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-3 pt-4">
            <Link
              href="/feed"
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 active:scale-[0.98] transition-all duration-150 text-sm"
            >
              둘러보기 (게시판 바로가기)
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/login"
                className="py-3 bg-slate-900 hover:bg-slate-850 text-slate-200 rounded-xl font-semibold border border-slate-850 text-center text-xs active:scale-[0.98] transition-all"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="py-3 bg-slate-900 hover:bg-slate-850 text-slate-200 rounded-xl font-semibold border border-slate-850 text-center text-xs active:scale-[0.98] transition-all"
              >
                회원가입
              </Link>
            </div>
          </div>

          {/* Footer info */}
          <div className="pt-8">
            <span className="text-[11px] text-slate-500 tracking-widest font-mono uppercase">
              SAMPYEONG DESK LAB &copy; 2026
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
