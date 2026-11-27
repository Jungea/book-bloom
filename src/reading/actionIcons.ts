import {
  Bookmark,
  BookX,
  CircleCheck,
  Pause,
  Play,
  Repeat,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react'

// 독서 상태 동작(`bookActions`의 label)과 아이콘의 짝. 화면 코드와 분리해 모든 동작에 아이콘이 있는지 테스트한다.
//
// 아이콘만 쓰는 것은 뜻이 분명한 동작뿐이다(삭제 · 수정 · 뒤로 가기 · 수정 취소는 화면 코드에서 지정).
// `완독 취소`·`재독 시작`처럼 헷갈릴 수 있는 동작과 독서 상태 동작은 아이콘과 글자를 함께 보인다.

export interface ActionIcon {
  readonly icon: LucideIcon
  /** true면 글자 없이 아이콘만 보이고 한국어 aria-label·툴팁으로 뜻을 전한다. */
  readonly iconOnly: boolean
}

const ACTION_ICONS: Readonly<Record<string, ActionIcon>> = {
  '읽고 싶음': { icon: Bookmark, iconOnly: false },
  시작: { icon: Play, iconOnly: false },
  재개: { icon: Play, iconOnly: false },
  완독: { icon: CircleCheck, iconOnly: false },
  '일시 중단': { icon: Pause, iconOnly: false },
  하차: { icon: BookX, iconOnly: false },
  '재독 시작': { icon: Repeat, iconOnly: false },
  '완독 취소': { icon: Undo2, iconOnly: false },
  삭제: { icon: Trash2, iconOnly: true },
}

/** 동작 이름에 맞는 아이콘. 짝이 없으면 undefined라 글자만 있는 버튼으로 보인다. */
export function actionIcon(label: string): ActionIcon | undefined {
  return ACTION_ICONS[label]
}
