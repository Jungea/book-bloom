import { ringArc } from './progressRing'

/**
 * 원형 진행률 링을 캔버스 2D로 그린다. Phaser Graphics(WebGL)의 선·호는 짧은 조각(삼각형)으로 나눠 그려서
 * 작은 링에서 이음새 무늬(빗살)와 계단이 생기므로, 링은 캔버스 2D(진짜 안티앨리어싱)로 기기 해상도 텍스처에 그린다.
 *
 * 색: 배경(베이지 벽, 갈색 데스크)이 어디든 보이도록 어두운 테두리 위에 흰 바탕 원과 파란 채움을 올린다.
 * 노란 채움은 노란 벽에서 눈에 띄지 않았다.
 */

export const RING_RADIUS = 7
export const RING_STROKE = 2
/** 어두운 테두리가 선 양쪽으로 더하는 두께(합계). 테두리 전체 두께는 RING_STROKE + RING_OUTLINE_EXTRA. */
export const RING_OUTLINE_EXTRA = 2
export const RING_OUTLINE_STYLE = 'rgba(30, 20, 12, 0.9)'
export const RING_TRACK_STYLE = 'rgba(255, 255, 255, 0.92)'
export const RING_FILL_STYLE = '#2f7dd1'

/** 링 텍스처의 한 변(픽셀). 바깥 반지름(반지름 + 테두리 두께의 절반)과 여백 1을 담는다. 기기 해상도 배율(zoom)을 곱한다. */
export function ringTextureSize(zoom: number): number {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return Math.ceil(2 * (RING_RADIUS + (RING_STROKE + RING_OUTLINE_EXTRA) / 2 + 1) * z)
}

/** 링을 `ctx`(정사각형 `size` 캔버스)에 그린다. 진행률은 12시 방향에서 시계 방향으로 찬다. */
export function drawRingCanvas(ctx: CanvasRenderingContext2D, size: number, zoom: number, progress: number): void {
  ctx.clearRect(0, 0, size, size)
  const center = size / 2
  const radius = RING_RADIUS * zoom

  // 어두운 테두리(전체 한 바퀴, 선보다 두껍게)
  ctx.lineWidth = (RING_STROKE + RING_OUTLINE_EXTRA) * zoom
  ctx.strokeStyle = RING_OUTLINE_STYLE
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.stroke()

  // 흰 바탕 원
  ctx.lineWidth = RING_STROKE * zoom
  ctx.strokeStyle = RING_TRACK_STYLE
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.stroke()

  // 진행률만큼 파란 호
  const arc = ringArc(progress)
  if (arc.end > arc.start) {
    ctx.strokeStyle = RING_FILL_STYLE
    ctx.beginPath()
    ctx.arc(center, center, radius, arc.start, arc.end, false)
    ctx.stroke()
  }
}
