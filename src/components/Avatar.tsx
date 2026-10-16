/**
 * 프로필 사진(원형). 사진이 없으면 이름 첫 글자를 보여준다.
 * 이름 첫 글자는 [...name][0]로 자른다: 이모지·결합 문자가 첫 글자일 때 name[0]은 깨진 반쪽 문자가 되기 때문.
 * 장식용이라 alt는 비운다(옆에 항상 이름이 함께 나온다).
 */
export default function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  return (
    <span
      className="shrink-0 rounded-full bg-muted overflow-hidden inline-flex items-center justify-center ring-1 ring-black/5"
      style={{ width: size, height: size }}
    >
      {src ? (
        // 외부(Supabase Storage) 이미지라 next/image 원격 설정 없이 일반 img를 쓴다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-semibold text-muted-foreground" style={{ fontSize: Math.round(size * 0.42) }} aria-hidden="true">
          {[...name][0]?.toUpperCase()}
        </span>
      )}
    </span>
  );
}
