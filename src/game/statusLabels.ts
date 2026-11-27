/** 상태바의 보관함 도서 수(아이콘 옆 숫자). 보관함은 책장에 자리가 없어 넘어온 도서가 쌓이는 곳이다. */
export function storageCountText(count: number): string {
  return String(count)
}
