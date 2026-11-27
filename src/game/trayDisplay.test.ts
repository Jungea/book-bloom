import { describe, expect, it } from 'vitest'
import { trayDisplay } from './trayDisplay'

describe('trayDisplay', () => {
  it('반납 대기가 없으면 빈 트레이다', () => {
    expect(trayDisplay(0)).toEqual({ showBooks: false, label: null })
  })

  it('반납 대기가 있으면 쌓인 책과 권수를 보인다', () => {
    expect(trayDisplay(1)).toEqual({ showBooks: true, label: '반납 1권' })
    expect(trayDisplay(12)).toEqual({ showBooks: true, label: '반납 12권' })
  })

  it('올바르지 않은 값은 빈 트레이로 본다', () => {
    expect(trayDisplay(-1)).toEqual({ showBooks: false, label: null })
    expect(trayDisplay(1.5)).toEqual({ showBooks: false, label: null })
    expect(trayDisplay(Number.NaN)).toEqual({ showBooks: false, label: null })
  })
})
