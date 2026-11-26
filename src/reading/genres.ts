// 독서 관리와 타이쿤이 공유하는 기본 대분류(docs/03 "장르 분류 체계"). 세부 장르는 미정이다.
export const GENRES = [
  '문학',
  '인문',
  '사회',
  '역사',
  '경제·경영',
  '과학·기술',
  '자기계발',
  '예술·문화',
  '생활',
  '기타',
] as const

export type Genre = (typeof GENRES)[number]

export function isGenre(value: unknown): value is Genre {
  return typeof value === 'string' && (GENRES as readonly string[]).includes(value)
}
