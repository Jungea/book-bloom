// 도서관 장면의 기준 좌표(논리 640×360). 장면과 손님 경로가 함께 쓴다.

export const BASE_WIDTH = 640
export const HEIGHT = 360
export const STATUS_HEIGHT = 32
export const FLOOR_Y = 240
/** 4슬롯의 가로 중심: 데스크, 책장, 빈 슬롯, 반납 트레이. */
export const SLOT_CENTERS = [80, 240, 400, 560] as const

/** 캔버스를 논리 크기의 몇 배 해상도로 그리는지의 상한(매우 큰 화면에서 캔버스가 과하게 커지는 것을 막는다). */
export const MAX_RENDER_ZOOM = 4

/**
 * 캔버스를 기기 화면 픽셀에 맞춰 그리기 위한 배율(논리 높이 360 기준).
 * 논리 크기(360 높이) 그대로 그린 캔버스를 CSS로 비정수배 확대하면 텍스트·링·회전한 손님이 계단처럼 깨져 보인다.
 * 이 배율만큼 캔버스 해상도를 키우고 카메라 줌으로 논리 좌표를 그대로 쓴다. 유효하지 않은 값은 1이다.
 */
export function renderZoomFor(clientWidth: number, clientHeight: number, devicePixelRatio: number): number {
  const logicalWidth = logicalWidthFor(clientWidth, clientHeight)
  if (logicalWidth === null || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1
  // 캔버스는 호스트 안에 비율을 유지하며 들어가므로 실제로 보이는 높이는 가로가 모자라면 호스트 높이보다 작다.
  const displayedHeight = Math.min(clientHeight, (clientWidth * HEIGHT) / logicalWidth)
  return Math.min(MAX_RENDER_ZOOM, Math.max(1, (displayedHeight * devicePixelRatio) / HEIGHT))
}

/** 에셋은 논리 크기의 2배 해상도로 제작되어 장면에서 0.5배로 그린다(논리 640×360 기준 제작 규격). */
export const ASSET_SCALE = 0.5

/**
 * 스프라이트 텍스처 필터. 에셋을 화면 픽셀보다 크게 그릴 때(확대)는 픽셀 아트의 경계를 지키는 최근접이 맞다.
 * 그러나 캔버스 배율이 2 미만이면 에셋(2배 해상도)을 실제로는 줄여 그리게 되고, 최근접은 원본 픽셀을
 * 불규칙하게 건너뛰어 움직이거나 기울 때 깨져 보인다. 그 구간에서만 선형(축소 평균)을 쓴다.
 */
export function spriteFilterFor(renderZoom: number): 'nearest' | 'linear' {
  return ASSET_SCALE * renderZoom < 1 ? 'linear' : 'nearest'
}

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
