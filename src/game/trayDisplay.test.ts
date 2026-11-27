import { describe, expect, it } from 'vitest'
import { trayDisplay } from './trayDisplay'

describe('trayDisplay', () => {
  it('반납 대기가 없으면 빈 트레이다', () => {
    expect(trayDisplay(0)).toEqual({ showBooks: false })
  })

  it('반납 대기가 있으면 권수와 상관없이 쌓인 책과 아이콘을 보인다(권수는 표시하지 않는다)', () => {
    expect(trayDisplay(1)).toEqual({ showBooks: true })
    expect(trayDisplay(12)).toEqual({ showBooks: true })
  })

  it('올바르지 않은 값은 빈 트레이로 본다', () => {
    expect(trayDisplay(-1)).toEqual({ showBooks: false })
    expect(trayDisplay(1.5)).toEqual({ showBooks: false })
    expect(trayDisplay(Number.NaN)).toEqual({ showBooks: false })
  })
})
