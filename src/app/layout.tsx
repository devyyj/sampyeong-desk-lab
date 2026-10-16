import type { Metadata, Viewport } from "next";
import "./globals.css";
import TabBar from "@/components/TabBar";
import AppHeader from "@/components/AppHeader";
import Fab from "@/components/Fab";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "삼평 데스크 랩 (SDL)",
  description: "사내 보드게임 동호회 회원들 간의 소통 및 보드게임 인프라 관리를 위한 커뮤니티",
};

// viewport-fit=cover여야 아이폰에서 env(safe-area-inset-*)가 0이 아닌 값이 되어, 하단 탭바가 홈 인디케이터를 피할 수 있다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

/**
 * 앱 셸: 맨 위 로고 헤더(모바일) + 화면 아래 탭바(넓은 화면에서는 로고가 있는 왼쪽 레일) + 가운데 콘텐츠 컬럼.
 * 각 화면의 제목은 페이지가 TopBar로 직접 그린다(뒤로 가기·액션이 화면마다 달라서).
 * 콘텐츠 컬럼은 모바일 폭(최대 640px)을 기준으로 두고, 넓은 화면에서는 레일 폭(lg:pl-56)만큼 비켜 가운데 놓는다.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/*
          Pretendard(한글 지원)를 셀프 호스팅한다. dynamic-subset은 글자 범위별로 92개 파일로 쪼개져 있어
          브라우저가 화면에 실제로 나온 글자의 조각만 받는다(전체 가변 폰트 약 2MB를 모바일에서 통째로 받지 않음).
          next/font/local은 unicode-range 분할 파일 묶음을 다루지 못해 정적 CSS로 연결한다.
        */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
      </head>
      <body className="min-h-full bg-background text-foreground lg:pl-56">
        <AppHeader />
        <TabBar />
        {/* 하단 탭바(56px)+safe-area만큼 아래 여백을 둬 마지막 콘텐츠가 탭바에 가리지 않게 한다. */}
        <main className="w-full max-w-[640px] mx-auto px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12">
          {children}
        </main>
        <Fab isLoggedIn={!!session} isAdmin={!!session?.isAdmin} />
      </body>
    </html>
  );
}
