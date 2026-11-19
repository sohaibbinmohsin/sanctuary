import { describe, it, expect } from 'vitest'
import { parseReporterFromNotes } from '@/features/reports/domain/reporterNotes'

describe('parseReporterFromNotes', () => {
  it('extracts name and phone from createAnimalFromRescueReport note format', () => {
    const notes = [
      'Rescue report: TEST-R501',
      'Complaint: Limping',
      'Reporter: Walk-in Reporter (0300-0000000)',
    ].join('\n')

    expect(parseReporterFromNotes(notes)).toEqual({
      name: 'Walk-in Reporter',
      phone: '0300-0000000',
    })
  })

  it('extracts name-only when phone was not written', () => {
    expect(parseReporterFromNotes('Reporter: Walk-in Reporter')).toEqual({
      name: 'Walk-in Reporter',
      phone: null,
    })
  })

  it('returns null when no reporter line is present', () => {
    expect(parseReporterFromNotes('Rescue report: TEST-R501\nComplaint: Limping')).toBeNull()
    expect(parseReporterFromNotes(null)).toBeNull()
    expect(parseReporterFromNotes('')).toBeNull()
  })
})
