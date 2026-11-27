import { ringArc } from './progressRing'

/**
 * 원형 진행률 링을 캔버스 2D로 그린다. Phaser Graphics(WebGL)의 선·호는 짧은 조각(삼각형)으로 나눠 그려서
 * 작은 링에서 이음새 무늬(빗살)와 계단이 생기므로, 링은 캔버스 2D(진짜 안티앨리어싱)로 기기 해상도 텍스처에 그린다.
 */

export const RING_RADIUS = 7
export const RING_STROKE = 2
/** 바탕 원: 짙은 갈색(#3a2a1a) 35%(반투명). 캔버스 2D라 알파를 써도 이음새 얼룩이 없다. */
export const RING_TRACK_STYLE = 'rgba(58, 42, 26, 0.35)'
export const RING_FILL_STYLE = '#d9a441'

/** 링 텍스처의 한 변(픽셀). 바깥 반지름(반지름 + 선 두께의 절반)과 여백 1을 담는다. 기기 해상도 배율(zoom)을 곱한다. */
export function ringTextureSize(zoom: number): number {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return Math.ceil(2 * (RING_RADIUS + RING_STROKE / 2 + 1) * z)
}

/** 링을 `ctx`(정사각형 `size` 캔버스)에 그린다. 진행률은 12시 방향에서 시계 방향으로 찬다. */
export function drawRingCanvas(ctx: CanvasRenderingContext2D, size: number, zoom: number, progress: number): void {
  ctx.clearRect(0, 0, size, size)
  const center = size / 2
  const radius = RING_RADIUS * zoom
  ctx.lineWidth = RING_STROKE * zoom

  ctx.strokeStyle = RING_TRACK_STYLE
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.stroke()

  const arc = ringArc(progress)
  if (arc.end > arc.start) {
    ctx.strokeStyle = RING_FILL_STYLE
    ctx.beginPath()
    ctx.arc(center, center, radius, arc.start, arc.end, false)
    ctx.stroke()
  }
}
