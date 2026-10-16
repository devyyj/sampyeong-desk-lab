import { notFound } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import CreateMemberForm from './CreateMemberForm';

export const dynamic = 'force-dynamic';

/**
 * 회원 추가(관리자 전용). 회원 탭의 ＋ 버튼(관리자에게만 보임)으로 들어온다.
 * 관리자 화면처럼 존재 자체를 숨기려고 403 대신 404를 돌려주고, 권한은 세션이 아닌 DB로 확인한다.
 * 비회원은 route-guard가 먼저 로그인 화면으로 보낸다.
 */
export default async function NewMemberPage() {
  if (!(await getAdminUser())) notFound();
  return <CreateMemberForm />;
}
