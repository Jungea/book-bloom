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
 * 반납 대기 아이콘 — lucide `book-down`: path `M12 13V7`, path `m9 10 3 3 3-3`와
 * path `M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20`(책 모양).
 * 작은 크기(16~20px)에서도 알아보기 쉬워 트레이 표시에 쓴다(`inbox`는 16px에서 뭉개졌다).
 */
export function drawBookDownIcon(graphics: Graphics, color: number): void {
  graphics.clear()
  graphics.lineStyle(CANVAS_ICON_STROKE, color, 1)

  graphics.beginPath()
  graphics.moveTo(12, 13)
  graphics.lineTo(12, 7)
  graphics.strokePath()

  graphics.beginPath()
  graphics.moveTo(9, 10)
  graphics.lineTo(12, 13)
  graphics.lineTo(15, 10)
  graphics.strokePath()

  // 책 모양: 왼쪽 위 모서리(반지름 2.5), 오른쪽 위·아래 모서리(반지름 1), 왼쪽 아래의 반원(반지름 2.5, 중심 (6.5, 19.5)).
  graphics.beginPath()
  graphics.moveTo(4, 19.5)
  graphics.lineTo(4, 4.5)
  graphics.arc(6.5, 4.5, 2.5, Math.PI, (Math.PI * 3) / 2, false)
  graphics.lineTo(19, 2)
  graphics.arc(19, 3, 1, -Math.PI / 2, 0, false)
  graphics.lineTo(20, 21)
  graphics.arc(19, 21, 1, 0, Math.PI / 2, false)
  graphics.lineTo(6.5, 22)
  graphics.arc(6.5, 19.5, 2.5, Math.PI / 2, (Math.PI * 3) / 2, false)
  graphics.lineTo(20, 17)
  graphics.strokePath()
}
