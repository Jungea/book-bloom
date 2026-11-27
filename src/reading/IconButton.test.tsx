import { Trash2 } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IconButton } from './IconButton'
import { ICON_SIZE, ICON_STROKE_WIDTH } from './icons'

function attributes(markup: string, name: string): string[] {
  return [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((match) => match[1])
}

describe('IconButton: 아이콘만 있는 버튼', () => {
  const markup = renderToStaticMarkup(
    <IconButton icon={Trash2} label="삭제" accessibleName="데미안 삭제" iconOnly onClick={() => {}} />,
  )

  it('한국어 aria-label과 PC 툴팁(title)을 갖고 보이는 글자는 없다', () => {
    expect(markup).toContain('aria-label="데미안 삭제"')
    expect(markup).toContain('title="삭제"')
    expect(markup).not.toContain('<span>')
  })

  it('정사각형 아이콘 버튼 클래스이고 type은 기본이 button이다', () => {
    expect(markup).toContain('class="icon-button icon-button--only"')
    expect(markup).toContain('type="button"')
  })

  it('접근성 이름을 따로 주지 않으면 label이 aria-label이 된다', () => {
    const plain = renderToStaticMarkup(<IconButton icon={Trash2} label="삭제" iconOnly />)
    expect(plain).toContain('aria-label="삭제"')
  })
})

describe('IconButton: 아이콘과 글자를 함께 보이는 버튼', () => {
  const markup = renderToStaticMarkup(<IconButton icon={Trash2} label="완독 취소" />)

  it('글자가 보이고 중복 aria-label은 없다', () => {
    expect(markup).toContain('<span>완독 취소</span>')
    expect(markup).not.toContain('aria-label="완독 취소"')
    expect(markup).not.toContain('icon-button--only')
  })

  it('submit 타입과 추가 클래스를 그대로 전달한다', () => {
    const submit = renderToStaticMarkup(<IconButton type="submit" icon={Trash2} label="저장" className="extra" />)
    expect(submit).toContain('type="submit"')
    expect(submit).toContain('class="icon-button extra"')
  })
})

describe('아이콘 공통 속성', () => {
  const markup = renderToStaticMarkup(<IconButton icon={Trash2} label="삭제" iconOnly />)

  it('크기와 선 두께가 통일되어 있고 색은 currentColor다', () => {
    expect(attributes(markup, 'width')).toContain(String(ICON_SIZE))
    expect(attributes(markup, 'height')).toContain(String(ICON_SIZE))
    expect(attributes(markup, 'stroke-width')).toContain(String(ICON_STROKE_WIDTH))
    expect(attributes(markup, 'stroke')).toContain('currentColor')
  })

  it('아이콘은 장식이라 보조 기술에서 숨긴다', () => {
    expect(markup).toContain('aria-hidden="true"')
  })
})
