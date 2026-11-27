import type Phaser from 'phaser'

/** lucide `Archive` 아이콘의 기준 크기(24×24 격자)와 선 두께. */
export const ARCHIVE_ICON_GRID = 24
export const ARCHIVE_ICON_STROKE = 2

/**
 * 상태바의 보관함 아이콘. 독서 관리 화면의 아이콘 세트(lucide)와 같은 `Archive` 모양을 Phaser Graphics로 그린다.
 * 캔버스(Phaser)에서는 `lucide-react` 컴포넌트를 쓸 수 없어 같은 도형(위쪽 상자, 몸통, 가운데 손잡이 선)을 직접 그린다.
 * 벡터라서 캔버스 해상도(기기 픽셀)에 맞춰 또렷하다. 격자 좌표(0~24)로 그리므로 호출한 쪽에서
 * `setPosition`(왼쪽 위)과 `setScale(크기 / ARCHIVE_ICON_GRID)`로 놓는다.
 *
 * 도형 출처: lucide `archive` — rect(2,3,20×5, rx1), path `M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8`, path `M10 12h4`.
 */
export function drawArchiveIcon(graphics: Phaser.GameObjects.Graphics, color: number): void {
  graphics.clear()
  graphics.lineStyle(ARCHIVE_ICON_STROKE, color, 1)
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
