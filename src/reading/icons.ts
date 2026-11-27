// 사용자용 React 화면의 아이콘 공통 설정(lucide-react). 색은 `currentColor`라 버튼 글자색(화이트 + 슬레이트 테마 토큰)을 따른다.
// 크기와 선 두께를 한 곳에서 정해 모든 아이콘을 통일한다. 개발자 패널과 Phaser 도서관 화면에는 쓰지 않는다.

export const ICON_SIZE = 18
export const ICON_STROKE_WIDTH = 2

/** 모든 아이콘에 펼쳐 쓰는 공통 속성. 장식이므로 보조 기술에서는 숨기고, 뜻은 버튼의 이름(글자 또는 aria-label)이 전한다. */
export const ICON_PROPS = {
  size: ICON_SIZE,
  strokeWidth: ICON_STROKE_WIDTH,
  'aria-hidden': true,
  focusable: false,
} as const
