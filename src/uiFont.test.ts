import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { UI_FONT_FAMILY } from './uiFont'

describe('UI_FONT_FAMILY', () => {
  it('독서 관리 화면 CSS(body)와 같은 글꼴 목록이다', () => {
    const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
    expect(css).toContain(`font-family: ${UI_FONT_FAMILY};`)
  })

  it('도서관 화면 글자(Phaser)가 이 목록을 쓴다', () => {
    const scene = readFileSync(new URL('./game/LibraryScene.ts', import.meta.url), 'utf8')
    expect(scene).not.toContain("fontFamily: 'sans-serif'")
    expect(scene.match(/fontFamily: UI_FONT_FAMILY/g)?.length).toBe(2)
  })
})
