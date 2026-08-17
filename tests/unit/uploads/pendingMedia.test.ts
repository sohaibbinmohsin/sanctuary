import { describe, expect, it } from 'vitest'
import {
  pendingUploadsBody,
  pendingUploadsHeadline,
} from '@/features/uploads/domain/pendingMedia'

describe('pending upload copy', () => {
  it('names a single waiting item', () => {
    expect(pendingUploadsHeadline(1, 0)).toBe('1 waiting to send')
  })

  it('calls out failures without sounding like an empty shelter', () => {
    expect(pendingUploadsHeadline(3, 1)).toBe('3 waiting · 1 need a retry')
    expect(pendingUploadsHeadline(2, 2)).toBe('2 couldn’t send')
  })

  it('explains offline vs in-app sending', () => {
    expect(pendingUploadsBody(false)).toMatch(/No internet/i)
    expect(pendingUploadsBody(true)).toMatch(/app is open/i)
  })
})
