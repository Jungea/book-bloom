import type Phaser from 'phaser'

/**
 * 도서관 화면(Phaser 캔버스)의 아이콘. 독서 관리 화면의 아이콘 세트(lucide)와 같은 모양을 Phaser Graphics로 그린다.
 * 캔버스에서는 `lucide-react` 컴포넌트를 쓸 수 없어 설치된 lucide의 도형 데이터를 옮겨 그린다.
 * 벡터라서 캔버스 해상도(기기 픽셀)에 맞춰 또렷하다. 모두 격자 좌표(0~24)로 그리므로 호출한 쪽에서
 * `setPosition`(왼쪽 위)과 `setScale(크기 / CANVAS_ICON_GRID)`로 놓는다.
 * 작은 크기(16~20px)에서 알아보기 쉬운 단순한 모양을 고른다(복잡한 아이콘은 선이 1.3~1.7px라 뭉개진다).
 */

/** lucide 아이콘의 기준 크기(24×24 격자)와 선 두께. */
export const CANVAS_ICON_GRID = 24
export const CANVAS_ICON_STROKE = 2

type Graphics = Phaser.GameObjects.Graphics

const PI = Math.PI

/**
 * 보관함 아이콘 — lucide `package`(상자): 여섯 모서리가 둥근 육각형 윤곽(반지름 2)과 안쪽 세 선.
 * path `M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z`,
 * path `M12 22V12`, polyline `3.29 7 12 12 20.71 7`, path `m7.5 4.27 9 5.15`.
 */
export function drawPackageIcon(graphics: Graphics, color: number): void {
  graphics.clear()
  graphics.lineStyle(CANVAS_ICON_STROKE, color, 1)

  // 윤곽: 모서리 호의 중심은 아래 꼭짓점 (12,20), 오른쪽 아래 (19,16), 오른쪽 위 (19,8), 위 꼭짓점 (12,4),
  // 왼쪽 위 (5,8), 왼쪽 아래 (5,16)이고 반지름은 모두 2다. 모두 반시계 방향(anticlockwise)으로 돈다.
  graphics.beginPath()
  graphics.moveTo(11, 21.73)
  graphics.arc(12, 20, 2, (2 * PI) / 3, PI / 3, true)
  graphics.lineTo(20, 17.73)
  graphics.arc(19, 16, 2, PI / 3, 0, true)
  graphics.lineTo(21, 8)
  graphics.arc(19, 8, 2, 0, -PI / 3, true)
  graphics.lineTo(13, 2.27)
  graphics.arc(12, 4, 2, -PI / 3, (-2 * PI) / 3, true)
  graphics.lineTo(4, 6.27)
  graphics.arc(5, 8, 2, (-2 * PI) / 3, -PI, true)
  graphics.lineTo(3, 16)
  graphics.arc(5, 16, 2, PI, (2 * PI) / 3, true)
  graphics.closePath()
  graphics.strokePath()

  graphics.beginPath()
  graphics.moveTo(12, 22)
  graphics.lineTo(12, 12)
  graphics.strokePath()

  graphics.beginPath()
  graphics.moveTo(3.29, 7)
  graphics.lineTo(12, 12)
  graphics.lineTo(20.71, 7)
  graphics.strokePath()

  graphics.beginPath()
  graphics.moveTo(7.5, 4.27)
  graphics.lineTo(16.5, 9.42)
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
  graphics.arc(6.5, 4.5, 2.5, PI, (PI * 3) / 2, false)
  graphics.lineTo(19, 2)
  graphics.arc(19, 3, 1, -PI / 2, 0, false)
  graphics.lineTo(20, 21)
  graphics.arc(19, 21, 1, 0, PI / 2, false)
  graphics.lineTo(6.5, 22)
  graphics.arc(6.5, 19.5, 2.5, PI / 2, (PI * 3) / 2, false)
  graphics.lineTo(20, 17)
  graphics.strokePath()
}
