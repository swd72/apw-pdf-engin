import React from 'react'

export interface IconProps {
  size?: number
  className?: string
}

function Svg({
  size = 20,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export function TextIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M4 5h12" />
      <path d="M4 9.5h12" />
      <path d="M4 14h8" />
    </Svg>
  )
}

export function TableIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <rect x="3" y="3.5" width="14" height="13" rx="1.8" />
      <path d="M3 8h14" />
      <path d="M3 12.2h14" />
      <path d="M9.5 3.5v13" />
    </Svg>
  )
}

export function ColumnsIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="6" height="12" rx="1.4" />
      <rect x="11" y="4" width="6" height="12" rx="1.4" />
    </Svg>
  )
}

export function SignatureIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M3.5 14.5c2-3.5 3.5-3.5 4.5-1 .8 2 2-1.5 3.5-1.5 1.2 0 2 1.5 4.5 1.5" />
      <path d="M3 16.5h14" />
    </Svg>
  )
}

export function ImageIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="14" height="12" rx="1.8" />
      <circle cx="7.5" cy="8" r="1.3" />
      <path d="M4.5 14.5l4-3.8 2.8 2.6 2.2-2 2.5 3.2" />
    </Svg>
  )
}

export function LineIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M3 10h14" />
    </Svg>
  )
}

export function SpaceIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M4 4.5h12" />
      <path d="M4 15.5h12" />
      <path d="M10 7v6" />
      <path d="M8 8.8L10 6.8l2 2" />
      <path d="M8 11.2l2 2 2-2" />
    </Svg>
  )
}

export function PageBreakIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M5 3.5h10v4.5H5z" />
      <path d="M5 12h10v4.5H5z" />
      <path d="M3 10h2.5M8.8 10h2.4M14.5 10H17" />
    </Svg>
  )
}

export function RepeatIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M14.5 4.5l2 2-2 2" />
      <path d="M3.5 9.5V8a1.5 1.5 0 0 1 1.5-1.5h11.5" />
      <path d="M5.5 15.5l-2-2 2-2" />
      <path d="M16.5 10.5V12a1.5 1.5 0 0 1-1.5 1.5H3.5" />
    </Svg>
  )
}

export function ConditionIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M10 3.5l6.5 6.5-6.5 6.5L3.5 10 10 3.5z" />
      <path d="M8.5 8.8a1.5 1.5 0 1 1 2.2 1.3c-.5.3-.7.6-.7 1.1" />
      <circle cx="10" cy="13.3" r="0.5" fill="currentColor" />
    </Svg>
  )
}

export function DragIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <circle cx="7.5" cy="5.5" r="0.9" fill="currentColor" />
      <circle cx="12.5" cy="5.5" r="0.9" fill="currentColor" />
      <circle cx="7.5" cy="10" r="0.9" fill="currentColor" />
      <circle cx="12.5" cy="10" r="0.9" fill="currentColor" />
      <circle cx="7.5" cy="14.5" r="0.9" fill="currentColor" />
      <circle cx="12.5" cy="14.5" r="0.9" fill="currentColor" />
    </Svg>
  )
}

export function UpIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M10 15.5v-11" />
      <path d="M5.5 9L10 4.5 14.5 9" />
    </Svg>
  )
}

export function DownIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M10 4.5v11" />
      <path d="M5.5 11l4.5 4.5 4.5-4.5" />
    </Svg>
  )
}

export function MoreIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="10" cy="10" r="1.1" fill="currentColor" />
      <circle cx="15" cy="10" r="1.1" fill="currentColor" />
    </Svg>
  )
}

export function PlusIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M10 4.5v11" />
      <path d="M4.5 10h11" />
    </Svg>
  )
}

export function TrashIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <path d="M4 6h12" />
      <path d="M7.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6" />
      <path d="M5.5 6l.8 9.5a1.2 1.2 0 0 0 1.2 1h5a1.2 1.2 0 0 0 1.2-1L14.5 6" />
    </Svg>
  )
}

export function CopyIcon(props: IconProps = {}) {
  return (
    <Svg {...props}>
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
      <path d="M4.5 12.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" />
    </Svg>
  )
}

export const text = TextIcon
export const table = TableIcon
export const columns = ColumnsIcon
export const signature = SignatureIcon
export const image = ImageIcon
export const line = LineIcon
export const space = SpaceIcon
export const pageBreak = PageBreakIcon
export const repeat = RepeatIcon
export const condition = ConditionIcon
export const drag = DragIcon
export const up = UpIcon
export const down = DownIcon
export const more = MoreIcon
export const plus = PlusIcon
export const trash = TrashIcon
export const copy = CopyIcon

export const icons = {
  text: TextIcon,
  table: TableIcon,
  columns: ColumnsIcon,
  signature: SignatureIcon,
  image: ImageIcon,
  line: LineIcon,
  space: SpaceIcon,
  pageBreak: PageBreakIcon,
  repeat: RepeatIcon,
  condition: ConditionIcon,
  drag: DragIcon,
  up: UpIcon,
  down: DownIcon,
  more: MoreIcon,
  plus: PlusIcon,
  trash: TrashIcon,
  copy: CopyIcon,
}
