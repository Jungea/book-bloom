// 원형 진행률 UI의 호 각도(라디안). 12시 방향에서 시작해 시계 방향으로 찬다.

export interface RingArc {
  readonly start: number
  readonly end: number
}

const TOP = -Math.PI / 2

/** 진행률(0~1)을 호 각도로 바꾼다. 범위를 벗어나거나 숫자가 아니면 0과 1 사이로 맞춘다. */
export function ringArc(progress: number): RingArc {
  const clamped = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0
  return { start: TOP, end: TOP + clamped * Math.PI * 2 }
}
