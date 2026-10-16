import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents } from '../../../../drizzle/schema';
import Markdown from '@/components/Markdown';

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
    <div className="max-w-3xl mx-auto space-y-6">
      <nav aria-label="동호회 안내 문서" className="flex gap-2 border-b border-border">
        {DOCUMENT_TABS.map((tab) => {
          const selected = tab.slug === slug;
          return (
            <Link
              key={tab.slug}
              href={`/about/${tab.slug}`}
              aria-current={selected ? 'page' : undefined}
              className={`px-3 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
                selected ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <article className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
        <Markdown>{doc.bodyMd}</Markdown>
      </article>
    </div>
  );
}
