import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Confluence에서 옮긴 Markdown 본문(활동 기록, 회칙, 보관함 안내)을 렌더링한다.
 *
 * - remark-gfm: 회칙·보관함 안내에 표가 있어 GFM 표/취소선을 지원해야 한다.
 * - 본문 속 HTML 태그는 실행하지 않는다. react-markdown은 rehype-raw를 붙이지 않으면 HTML을 그대로 렌더링하지 않으므로,
 *   이관 데이터나 이후 입력값에 <script>나 onerror 속성이 섞여 있어도 XSS가 되지 않는다. rehype-raw를 추가하지 말 것.
 * - 스타일은 globals.css의 .markdown 규칙이 담당한다(@tailwindcss/typography 의존성을 늘리지 않기 위함).
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 외부 링크는 새 탭으로 열어 읽던 활동 기록/문서를 잃지 않게 한다.
          a: ({ href, children: text }) => {
            const external = !!href && /^https?:\/\//.test(href);
            return (
              <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {text}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
