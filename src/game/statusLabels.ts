/** 상태바에 표시할 보관함 문구. 보관함은 책장에 자리가 없어 넘어온 도서가 쌓이는 곳이다. */
export function storageLabel(count: number): string {
  return `보관함 ${count}권`
}
