/**
 * 화면 글꼴 목록. 독서 관리 화면(React/CSS, `src/style.css`의 body)과 도서관 화면의 Phaser 글자가 같은 글꼴을 쓰도록
 * 한곳에서 정한다. 글꼴을 바꾸려면 여기와 `src/style.css`의 `body { font-family }`를 함께 바꾼다(테스트가 일치를 확인한다).
 */
export const UI_FONT_FAMILY = 'system-ui, sans-serif'

/**
 * 도서관 화면 글자(Phaser)의 굵기. 독서 관리 화면의 권수·제목(`내 도서 N권` 등 h1·h2·strong)이 굵은 글씨(700)라 같은 굵기로 맞춘다.
 * 독서 화면의 버튼은 600이다. 보통 굵기로 두면 같은 글꼴이어도 캔버스 글자만 얇아 보인다.
 */
export const UI_FONT_WEIGHT = 'bold'
