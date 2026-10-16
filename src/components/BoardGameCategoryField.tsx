import { fieldHint, fieldInput, fieldLabel } from '@/lib/form-styles';

/**
 * 보드게임 등록·수정 화면의 카테고리 입력.
 * 새 분류를 자유롭게 적을 수 있게 텍스트 입력으로 두되, 이미 쓰는 카테고리를 datalist로 추천해
 * 같은 분류가 "카드게임"/"카드 게임"처럼 표기 차이로 갈라지는 일을 줄인다(0004에서 한 번 정리한 문제).
 * 공백 정리·길이 검사는 서버 액션(readCategory)이 다시 한다.
 */
export default function BoardGameCategoryField({ categories, defaultValue }: { categories: string[]; defaultValue?: string | null }) {
  return (
    <div>
      <label htmlFor="category" className={fieldLabel}>카테고리</label>
      <input
        type="text"
        id="category"
        name="category"
        list="category-options"
        maxLength={50}
        defaultValue={defaultValue ?? ''}
        autoComplete="off"
        placeholder="예: 전략"
        className={fieldInput}
      />
      <datalist id="category-options">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <p className={fieldHint}>목록에서 고르거나 새로 입력하세요. 비우면 미분류로 보여요.</p>
    </div>
  );
}
