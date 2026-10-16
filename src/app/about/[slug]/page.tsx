import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents } from '../../../../drizzle/schema';
import Markdown from '@/components/Markdown';
import TopBar from '@/components/TopBar';
import { chipClass } from '@/lib/chip';

export const dynamic = 'force-dynamic';

// 탭 이름은 DB 제목(이모지 포함)과 별개로 짧게 둔다. 목록에 없는 slug는 DB를 조회하지 않고 404.
const DOCUMENT_TABS = [
  { slug: 'rules', label: '회칙' },
  { slug: 'shared-cabinet', label: '공용 보관함 안내' },
];

/** 동호회 안내 문서(회칙, 공용 보관함 안내). 비회원도 보는 공개 문서다. */
export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!DOCUMENT_TABS.some((tab) => tab.slug === slug)) notFound();

  const doc = await db.query.documents.findFirst({ where: eq(documents.slug, slug) });
  if (!doc) notFound();

  return (
    <div>
      {/* 문서 제목을 화면 제목(h1)으로 쓴다. MY 탭의 동호회 안내 메뉴에서 들어온다. */}
      <TopBar title={doc.title} backHref="/my" backLabel="MY로 돌아가기" />
      <nav aria-label="동호회 안내 문서" className="flex gap-2">
        {DOCUMENT_TABS.map((tab) => {
          const selected = tab.slug === slug;
          return (
            <Link
              key={tab.slug}
              href={`/about/${tab.slug}`}
              aria-current={selected ? 'page' : undefined}
              className={chipClass(selected)}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <article className="mt-4">
        <Markdown>{doc.bodyMd}</Markdown>
      </article>
    </div>
  );
}
