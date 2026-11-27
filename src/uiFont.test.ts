import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { UI_FONT_FAMILY, UI_FONT_WEIGHT } from './uiFont'

describe('UI_FONT_FAMILY', () => {
  it('독서 관리 화면 CSS(body)와 같은 글꼴 목록이다', () => {
    const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
    expect(css).toContain(`font-family: ${UI_FONT_FAMILY};`)
  })

  it('도서관 화면 글자(Phaser)가 이 목록을 쓴다', () => {
    const scene = readFileSync(new URL('./game/LibraryScene.ts', import.meta.url), 'utf8')
    expect(scene).not.toContain("fontFamily: 'sans-serif'")
    // 도서관 화면에 남은 Phaser 글자는 보관함 숫자 하나다(반납 권수 글자는 트레이 아이콘으로 바꿨다).
    expect(scene.match(/fontFamily: UI_FONT_FAMILY/g)?.length).toBe(1)
  })

  it('도서관 화면 글자의 굵기가 독서 관리 화면의 권수·제목과 같은 굵은 글씨다', () => {
    const scene = readFileSync(new URL('./game/LibraryScene.ts', import.meta.url), 'utf8')
    expect(UI_FONT_WEIGHT).toBe('bold')
    expect(scene.match(/fontStyle: UI_FONT_WEIGHT/g)?.length).toBe(1)
  })
})
