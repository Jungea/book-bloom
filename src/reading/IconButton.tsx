import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { ICON_PROPS } from './icons'

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children' | 'aria-label'> {
  icon: LucideIcon
  /** 한국어 이름. 아이콘만 있는 버튼에서는 `aria-label`과 PC 툴팁(`title`)이 되고, 글자를 함께 보일 때는 화면에 보이는 글자가 된다. */
  label: string
  /** 뜻이 분명한 동작(뒤로 가기·수정·삭제 등)은 아이콘만, 헷갈릴 수 있는 동작은 아이콘과 글자를 함께 보인다. */
  iconOnly?: boolean
  /** 아이콘만 있는 버튼의 접근성 이름을 더 구체적으로(예: 어떤 도서의 삭제인지) 줄 때 쓴다. 기본은 `label`. */
  accessibleName?: string
}

/**
 * 아이콘 버튼. 터치 영역은 CSS(`.reading-screen button`, `.view-switch`)의 44px 이상을 그대로 쓴다.
 * 아이콘만 있는 버튼은 정사각형(`icon-button--only`)이고 한국어 `aria-label`과 `title`을 반드시 갖는다.
 */
export function IconButton({
  icon: Icon,
  label,
  iconOnly = false,
  accessibleName,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const classes = ['icon-button', iconOnly ? 'icon-button--only' : '', className ?? ''].filter(Boolean).join(' ')
  if (iconOnly) {
    const name = accessibleName ?? label
    return (
      <button type={type} className={classes} aria-label={name} title={label} {...rest}>
        <Icon {...ICON_PROPS} />
      </button>
    )
  }
  return (
    <button type={type} className={classes} {...rest}>
      <Icon {...ICON_PROPS} />
      <span>{label}</span>
    </button>
  )
}
