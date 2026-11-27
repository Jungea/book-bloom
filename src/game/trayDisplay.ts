// 반납 트레이의 임시 표시(최종 UI 미정). 정리 전 도서가 있으면 쌓인 책 이미지를 얹고 권수를 적는다.

export interface TrayDisplay {
  /** 트레이 위에 쌓인 책 이미지를 보일지. */
  readonly showBooks: boolean
  /** 권수 문구. 비어 있으면 null. */
  readonly label: string | null
}

export function trayDisplay(returnedCount: number): TrayDisplay {
  if (!Number.isInteger(returnedCount) || returnedCount <= 0) return { showBooks: false, label: null }
  return { showBooks: true, label: `반납 ${returnedCount}권` }
}
