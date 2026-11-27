import { describe, expect, it } from 'vitest'
import { lockOrientation, orientationForView } from './orientation'

describe('orientationForView', () => {
  it('도서관은 가로, 독서 관리는 세로다', () => {
    expect(orientationForView('library')).toBe('landscape')
    expect(orientationForView('reading')).toBe('portrait')
  })
})

describe('lockOrientation', () => {
  it('웹(비네이티브)에서는 아무 일도 하지 않고 성공한다', async () => {
    await expect(lockOrientation('reading')).resolves.toBeUndefined()
  })
})
