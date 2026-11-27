// 도서관 장면의 기준 좌표(논리 640×360). 장면과 손님 경로가 함께 쓴다.

export const BASE_WIDTH = 640
export const HEIGHT = 360
export const STATUS_HEIGHT = 32
export const FLOOR_Y = 240
/** 4슬롯의 가로 중심: 데스크, 책장, 빈 슬롯, 반납 트레이. */
export const SLOT_CENTERS = [80, 240, 400, 560] as const

/**
 * 화면(호스트) 크기에 맞는 논리 너비. 기본 640이고 긴 화면에서는 비율에 맞춰 늘어난다.
 * 숨김 상태이거나 크기가 0인 호스트(0 나누기)에서는 null을 돌려준다. 그 상태로 캔버스를 만들면
 * 너비가 NaN이 되어 Phaser가 `Framebuffer status: Incomplete Attachment`로 부팅에 실패하고 화면이 검게 남는다.
 */
export function logicalWidthFor(clientWidth: number, clientHeight: number): number | null {
  if (!Number.isFinite(clientWidth) || !Number.isFinite(clientHeight)) return null
  if (clientWidth <= 0 || clientHeight <= 0) return null
  return Math.max(BASE_WIDTH, Math.round((HEIGHT * clientWidth) / clientHeight))
}
