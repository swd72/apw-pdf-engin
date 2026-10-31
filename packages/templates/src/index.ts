import type { TemplateDef } from '@apw-pdf/core'
import { memo } from './memo.js'
import { externalLetter } from './external-letter.js'
import { leaveSickPersonalMaternity } from './leave-sick.js'
import { leaveVacation } from './leave-vacation.js'

export * from './common.js'
export * from './memo.js'
export * from './external-letter.js'
export * from './leave-sick.js'
export * from './leave-vacation.js'

export const templates: Record<string, TemplateDef> = {
  memo,
  'external-letter': externalLetter,
  'leave-sick-personal-maternity': leaveSickPersonalMaternity,
  'leave-vacation': leaveVacation,
}
