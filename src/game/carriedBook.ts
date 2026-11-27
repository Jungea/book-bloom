import { VISITOR_HEAD_CENTER_X, VISITOR_HEAD_TOP } from './visitorLayout'

// 손님이 머리 위에 얹은 책의 배치. 책등 이미지(세로로 긴 모양)를 가로로 눕혀(90°) 머리 윗면에 수평으로 얹는다.
// 예약 후 이동할 때, 데스크에서 기다릴 때, 대출을 마치고 퇴장할 때 모두 같은 방향이다.

export interface BookPlacement {
  /** 책의 가운데 좌표(논리). */
  readonly x: number
  readonly y: number
  /** 책의 회전각(도). 눕힌 90°에 손님이 흔들리는 각도를 더해 머리 위에 평평하게 얹힌 채 함께 기운다. */
  readonly angle: number
}

/**
 * 책을 손님 머리 위에 놓는 위치와 각도.
 * 손님 이미지는 발 가운데를 기준으로 흔들리므로(걷는 동안 ±`swayAngle`도), 머리 윗면 중심을 같은 각도로 돌려
 * 책이 머리에서 떨어지거나 파묻히지 않게 한다. 책 두께의 절반만큼 머리 윗면 위로 올려 아래 면이 머리에 닿게 한다.
 *
 * @param feet 흔들림의 들썩임까지 반영한 손님 발 가운데 좌표
 * @param swayAngle 손님 이미지의 현재 회전각(도, 시계 방향이 +)
 * @param thickness 눕힌 책의 두께(눕히기 전 책등 이미지의 화면 너비)
 */
export function carriedBookPlacement(
  feet: { readonly x: number; readonly y: number },
  swayAngle: number,
  thickness: number,
): BookPlacement {
  const theta = (swayAngle * Math.PI) / 180
  const sin = Math.sin(theta)
  const cos = Math.cos(theta)
  // 발에서 머리 윗면 가운데까지: 오른쪽으로 HEAD_CENTER_X, 위로 HEAD_TOP. 이를 theta만큼 시계 방향으로 돌린다.
  const along = VISITOR_HEAD_TOP + thickness / 2 // 머리 윗면에서 책 가운데까지 더 올라간다
  return {
    x: feet.x + VISITOR_HEAD_CENTER_X * cos + along * sin,
    y: feet.y + VISITOR_HEAD_CENTER_X * sin - along * cos,
    angle: 90 + swayAngle,
  }
}
