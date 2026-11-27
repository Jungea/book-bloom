import { describe, expect, it, vi } from 'vitest'
import {
  createReturnSorter,
  MAX_SORT_TICK_MS,
  type SortHooks,
  type SortResult,
} from './returnSorter'

const SORT_MS = 1000

/** 반납 도서 id 목록을 앞에서부터 정리하는 가짜 훅. */
function fakeHooks(initial: string[], options: { failAfter?: number } = {}) {
  const queue = [...initial]
  const sorted: string[] = []
  let calls = 0
  const hooks: SortHooks = {
    returnedCount: () => queue.length,
    sortNext(): SortResult {
      calls += 1
      if (options.failAfter !== undefined && calls > options.failAfter) return { ok: false, reason: '실패' }
      const bookId = queue.shift()
      if (!bookId) return { ok: false, reason: '비어 있음' }
      sorted.push(bookId)
      return { ok: true, bookId }
    },
  }
  return { hooks, queue, sorted, calls: () => calls }
}

function run(sorter: ReturnType<typeof createReturnSorter>, totalMs: number, stepMs = 50) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) sorter.tick(stepMs)
}

describe('createReturnSorter: 클릭으로 시작', () => {
  it('처음에는 정지 상태이고 시간이 흘러도 정리하지 않는다', () => {
    const fake = fakeHooks(['a', 'b'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    expect(sorter.isActive()).toBe(false)
    run(sorter, 5000)
    expect(fake.sorted).toEqual([])
    expect(sorter.getProgress()).toBe(0)
  })

  it('반납 대기가 있을 때 클릭하면 정리가 시작된다', () => {
    const fake = fakeHooks(['a'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    expect(sorter.click()).toBe('STARTED')
    expect(sorter.isActive()).toBe(true)
    expect(sorter.getProgress()).toBe(0)
  })

  it('반납 대기가 없으면 클릭을 무시한다', () => {
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fakeHooks([]).hooks)
    expect(sorter.click()).toBe('IGNORED')
    expect(sorter.isActive()).toBe(false)
  })
})

describe('createReturnSorter: 시간제 정리', () => {
  it('진행률이 100%에 도달할 때마다 한 권씩 오래된 순서로 정리한다', () => {
    const fake = fakeHooks(['a', 'b', 'c'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()

    run(sorter, 500)
    expect(sorter.getProgress()).toBeCloseTo(0.5, 5)
    expect(fake.sorted).toEqual([])
    run(sorter, 500)
    expect(fake.sorted).toEqual(['a'])
    expect(sorter.getProgress()).toBeLessThan(0.1) // 다음 도서의 진행률은 초기화된다
    run(sorter, 1000)
    expect(fake.sorted).toEqual(['a', 'b'])
  })

  it('큰 시간이 한 번에 주어져도 상한 안에서 남은 시간을 다음 도서로 이어 쓴다', () => {
    const fake = fakeHooks(['a', 'b', 'c', 'd'])
    const sorter = createReturnSorter({ sortMs: 100 }, fake.hooks)
    sorter.click()
    sorter.tick(1_000_000) // 상한(250ms)만 진행: 2권 + 50ms
    expect(MAX_SORT_TICK_MS).toBe(250)
    expect(fake.sorted).toEqual(['a', 'b'])
    expect(sorter.getProgress()).toBeCloseTo(0.5, 5)
  })

  it('대기열이 비면 정지하고 새로 쌓인 도서는 다시 클릭해야 정리된다', () => {
    const fake = fakeHooks(['a'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()
    run(sorter, 1000)
    expect(fake.sorted).toEqual(['a'])
    expect(sorter.isActive()).toBe(false)
    expect(sorter.getProgress()).toBe(0)

    fake.queue.push('b') // 새 반납 도서가 쌓인다
    run(sorter, 5000)
    expect(fake.sorted).toEqual(['a']) // 클릭 전에는 정리하지 않는다
    expect(sorter.click()).toBe('STARTED')
    run(sorter, 1000)
    expect(fake.sorted).toEqual(['a', 'b'])
  })

  it('정리 중 새로 쌓인 도서는 대기열 끝에서 이어서 정리된다', () => {
    const fake = fakeHooks(['a', 'b'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()
    run(sorter, 500)
    fake.queue.push('c') // 정리 중에 도착
    run(sorter, 2500)
    expect(fake.sorted).toEqual(['a', 'b', 'c'])
    expect(sorter.isActive()).toBe(false)
  })
})

describe('createReturnSorter: 정리 중 클릭', () => {
  it('처리 중인 한 권이 즉시 정리되고 다음 도서의 진행률이 초기화된다', () => {
    const fake = fakeHooks(['a', 'b', 'c'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()
    run(sorter, 700)
    expect(sorter.click()).toBe('SORTED_NOW')
    expect(fake.sorted).toEqual(['a'])
    expect(sorter.getProgress()).toBe(0)
    expect(sorter.isActive()).toBe(true) // 대기열이 남아 있으면 계속 정리한다
  })

  it('마지막 한 권을 즉시 정리하면 멈춘다', () => {
    const fake = fakeHooks(['a'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()
    expect(sorter.click()).toBe('SORTED_NOW')
    expect(sorter.isActive()).toBe(false)
  })
})

describe('createReturnSorter: 정리 대상이 사라지거나 실패해도 막히지 않는다', () => {
  it('정리 중 대기열의 맨 앞 도서가 회수되면 다음 도서를 정리한다', () => {
    const fake = fakeHooks(['a', 'b'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()
    run(sorter, 600)
    fake.queue.shift() // 'a'의 독서 보상이 회수되어 대기열에서 빠졌다
    run(sorter, 500)
    expect(fake.sorted).toEqual(['b'])
    expect(sorter.isActive()).toBe(false)
  })

  it('정리 중 대기열이 모두 회수되어 비면 오류 없이 멈추고 훅을 반복 호출하지 않는다', () => {
    const fake = fakeHooks(['a', 'b'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()
    run(sorter, 500)
    fake.queue.length = 0
    run(sorter, 5000)
    expect(sorter.isActive()).toBe(false)
    expect(fake.sorted).toEqual([])
    expect(fake.calls()).toBe(0)
  })

  it('정리 훅이 실패하면 멈추고 반복해서 시도하지 않는다', () => {
    const fake = fakeHooks(['a', 'b'], { failAfter: 0 })
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()
    run(sorter, 10_000)
    expect(fake.calls()).toBe(1)
    expect(sorter.isActive()).toBe(false)
  })

  it('정리 중 클릭이 실패해도 멈추고 무시로 돌려준다', () => {
    const fake = fakeHooks(['a', 'b'], { failAfter: 0 })
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click() // 시작
    expect(sorter.click()).toBe('IGNORED')
    expect(sorter.isActive()).toBe(false)
  })
})

describe('createReturnSorter: 알림', () => {
  it('시작·정리·정지 때만 구독자에게 알리고 진행률 변화는 알리지 않는다', () => {
    const fake = fakeHooks(['a', 'b'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    const listener = vi.fn()
    sorter.subscribe(listener)

    sorter.click()
    expect(listener).toHaveBeenCalledTimes(1)
    run(sorter, 500)
    expect(listener).toHaveBeenCalledTimes(1)
    run(sorter, 500)
    expect(listener).toHaveBeenCalledTimes(2) // 한 권 정리
  })

  it('정리된 도서 id를 이동 애니메이션 구독자에게 알린다', () => {
    const fake = fakeHooks(['a', 'b'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    const seen: string[] = []
    const unsubscribe = sorter.onSorted((bookId) => seen.push(bookId))
    sorter.click()
    run(sorter, 2000)
    expect(seen).toEqual(['a', 'b'])
    unsubscribe()
  })

  it('구독자 하나가 예외를 던져도 나머지에게 알리고 정리를 계속한다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fake = fakeHooks(['a', 'b'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    const second = vi.fn()
    sorter.onSorted(() => {
      throw new Error('실패')
    })
    sorter.onSorted(second)
    sorter.click()
    run(sorter, 2000)
    expect(second).toHaveBeenCalledTimes(2)
    expect(fake.sorted).toEqual(['a', 'b'])
    vi.restoreAllMocks()
  })

  it('reset하면 정리가 멈추고 진행률이 초기화된다', () => {
    const fake = fakeHooks(['a', 'b'])
    const sorter = createReturnSorter({ sortMs: SORT_MS }, fake.hooks)
    sorter.click()
    run(sorter, 500)
    sorter.reset()
    expect(sorter.isActive()).toBe(false)
    expect(sorter.getProgress()).toBe(0)
  })
})
