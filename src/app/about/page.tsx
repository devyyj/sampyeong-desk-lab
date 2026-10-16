import { redirect } from 'next/navigation';

// /about 자체에는 내용이 없으므로 첫 문서(회칙)로 보낸다.
export default function AboutIndexPage() {
  redirect('/about/rules');
}
