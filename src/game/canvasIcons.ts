import type Phaser from 'phaser'

/**
 * 도서관 화면(Phaser 캔버스)의 아이콘. 독서 관리 화면의 아이콘 세트(lucide)와 같은 모양을 Phaser Graphics로 그린다.
 * 캔버스에서는 `lucide-react` 컴포넌트를 쓸 수 없어 설치된 lucide의 도형 데이터를 옮겨 그린다.
 * 벡터라서 캔버스 해상도(기기 픽셀)에 맞춰 또렷하다. 모두 격자 좌표(0~24)로 그리므로 호출한 쪽에서
 * `setPosition`(왼쪽 위)과 `setScale(크기 / CANVAS_ICON_GRID)`로 놓는다.
 */

/** lucide 아이콘의 기준 크기(24×24 격자)와 선 두께. */
export const CANVAS_ICON_GRID = 24
export const CANVAS_ICON_STROKE = 2

type Graphics = Phaser.GameObjects.Graphics

/**
 * 보관함 아이콘 — lucide `archive`: rect(2,3,20×5, rx1), path `M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8`, path `M10 12h4`.
 */
export function drawArchiveIcon(graphics: Graphics, color: number): void {
  graphics.clear()
  graphics.lineStyle(CANVAS_ICON_STROKE, color, 1)
  graphics.strokeRoundedRect(2, 3, 20, 5, 1)

  graphics.beginPath()
  graphics.moveTo(4, 8)
  graphics.lineTo(4, 19)
  graphics.arc(6, 19, 2, Math.PI, Math.PI / 2, true)
  graphics.lineTo(18, 21)
  graphics.arc(18, 19, 2, Math.PI / 2, 0, true)
  graphics.lineTo(20, 8)
  graphics.strokePath()

  graphics.beginPath()
  graphics.moveTo(10, 12)
  graphics.lineTo(14, 12)
  graphics.strokePath()
}

/**
 * 반납 트레이 아이콘 — lucide `inbox`: polyline `22 12 16 12 14 15 10 15 8 12 2 12`와
 * path `M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z`.
 */
export function drawInboxIcon(graphics: Graphics, color: number): void {
  graphics.clear()
  graphics.lineStyle(CANVAS_ICON_STROKE, color, 1)

  graphics.beginPath()
  graphics.moveTo(22, 12)
  graphics.lineTo(16, 12)
  graphics.lineTo(14, 15)
  graphics.lineTo(10, 15)
  graphics.lineTo(8, 12)
  graphics.lineTo(2, 12)
  graphics.strokePath()

  // 윗면 모서리 두 곳의 호는 중심이 (16.76, 6)·(7.24, 6), 반지름 2다.
  const startRight = Math.atan2(5.11 - 6, 18.55 - 16.76)
  const endLeft = Math.atan2(5.11 - 6, 5.45 - 7.24)
  graphics.beginPath()
  graphics.moveTo(5.45, 5.11)
  graphics.lineTo(2, 12)
  graphics.lineTo(2, 18)
  graphics.arc(4, 18, 2, Math.PI, Math.PI / 2, true)
  graphics.lineTo(20, 20)
  graphics.arc(20, 18, 2, Math.PI / 2, 0, true)
  graphics.lineTo(22, 12)
  graphics.lineTo(18.55, 5.11)
  graphics.arc(16.76, 6, 2, startRight, -Math.PI / 2, true)
  graphics.lineTo(7.24, 4)
  graphics.arc(7.24, 6, 2, -Math.PI / 2, endLeft, true)
  graphics.closePath()
  graphics.strokePath()
}
