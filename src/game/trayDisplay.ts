// 반납 트레이의 임시 표시(최종 UI 미정). 정리 전 도서가 있으면 쌓인 책 이미지와 트레이 아이콘을 보인다. 권수는 표시하지 않는다.

export interface TrayDisplay {
  /** 트레이 위에 쌓인 책 이미지와 트레이 아이콘을 보일지. */
  readonly showBooks: boolean
}

export function trayDisplay(returnedCount: number): TrayDisplay {
  return { showBooks: Number.isInteger(returnedCount) && returnedCount > 0 }
}
