export interface RescuingPartner {
  id: string
  name: string
  shortName: string
  tag: string
  region: string
  logoUrl: string
  socialUrl: string
  websiteUrl?: string
  description: string
  isGovernmentOrInstitutional?: boolean
}

export const KNOWN_RESCUE_PARTNERS: Record<string, RescuingPartner> = {
  parc: {
    id: 'parc',
    name: 'Police Animal Rescue Center',
    shortName: 'PARC Punjab Police',
    tag: 'Enforcement & Rescue',
    region: 'Punjab · Lahore / Multan / Rawalpindi',
    logoUrl: '/partners/partner-parc.png',
    socialUrl: 'https://www.instagram.com/parcpoliceanimalrescuecentre/',
    isGovernmentOrInstitutional: true,
    description:
      'Pioneering state-backed 24/7 rescue unit handling anti-cruelty enforcement, rapid veterinary dispatch, and emergency trauma triage.',
  },
  tosc: {
    id: 'tosc',
    name: 'Tales of Second Chances',
    shortName: 'TOSC Sanctuary',
    tag: 'Sanctuary & Shelter',
    region: 'Karachi',
    logoUrl: '/partners/partner-tales-of-second-chances.png',
    socialUrl: 'https://www.instagram.com/madeehakhatri/',
    description:
      'Animal sanctuary caring for 300+ rescued animals with medical triage, clinical care, and lifetime shelter.',
  },
  chiragh: {
    id: 'chiragh',
    name: 'Chiragh Ghar Animal Rehab',
    shortName: 'Chiragh Ghar',
    tag: 'Rehabilitation & Shelter',
    region: 'Lahore',
    logoUrl: '/partners/partner-chiragh-ghar.png',
    socialUrl: 'https://www.instagram.com/chiraghgharanimalrehab/',
    description:
      'Rehabilitation centre in Lahore providing medical care for rescued animals with partner veterinary clinics.',
  },
  whiskers: {
    id: 'whiskers',
    name: 'Whiskers FCCU',
    shortName: 'Whiskers FCCU',
    tag: 'Campus Rescue',
    region: 'FCC University, Lahore',
    logoUrl: '/partners/partner-whiskers-fccu.png',
    socialUrl: 'https://www.instagram.com/whiskers.fccu/',
    description:
      'Collegiate rescue managing TNR programs, injury recovery, active feeding routes, and adoption placements.',
  },
  nsac: {
    id: 'nsac',
    name: 'NUST Stray Animals Club',
    shortName: 'NSAC',
    tag: 'Campus Rescue',
    region: 'NUST Islamabad',
    logoUrl: '/partners/partner-nsac.png',
    socialUrl: 'https://www.instagram.com/nsac_nust/',
    description:
      'Student-run university welfare club conducting rescue triage and campus health maintenance.',
  },
  aws: {
    id: 'aws',
    name: 'Animal Welfare Society LUMS',
    shortName: 'AWS LUMS',
    tag: 'Campus Rescue',
    region: 'LUMS Lahore',
    logoUrl: '/partners/partner-aws-lums.png',
    socialUrl: 'https://www.instagram.com/aws_lums/',
    description:
      'Student-led campus welfare society managing veterinary vaccination drives and emergency foster care.',
  },
  gaza: {
    id: 'gaza',
    name: 'Gaza Animal Rescues',
    shortName: 'Gaza Animal Rescues',
    tag: 'Crisis Relief',
    region: 'Gaza',
    logoUrl: '/partners/partner-gaza-animal-rescues.png',
    socialUrl: 'https://www.instagram.com/gazaanimalrescues/',
    description:
      'Direct emergency relief, feeding, and medical treatment for animals in severe crisis conditions.',
  },
}

/**
 * Strips alphabetic prefixes (e.g. SANCTUARY-R, R, PARC-) and extracts
 * only the digits for clean display as a heading (e.g. "101").
 */
export function extractCaseNumber(raw?: string | null): string {
  if (!raw) return ''
  const digits = raw.replace(/\D+/g, '')
  return digits || raw
}

/**
 * Resolves which partner organization is rescuing this case based on org_id,
 * report prefix, or regional dispatch assignment.
 */
export function resolveRescuingPartner(report?: Record<string, any> | null): RescuingPartner | null {
  if (!report) return null

  const orgId = String(report.org_id || '').toLowerCase()
  const reportNumber = String(report.report_number || '').toLowerCase()
  const assigned = String(report.assigned_partner_id || report.rescuing_org || '').toLowerCase()

  for (const [key, partner] of Object.entries(KNOWN_RESCUE_PARTNERS)) {
    if (orgId.includes(key) || reportNumber.includes(key) || assigned.includes(key)) {
      return partner
    }
  }

  const status = String(report.status || '').toLowerCase()
  const city = String(report.city || '').toLowerCase()

  // When a case is accepted, dispatched, attended, or resolved, map to the regional rescue partner
  if (['accepted', 'dispatched', 'attended', 'resolved', 'completed'].includes(status)) {
    if (city.includes('islamabad') || city.includes('rawalpindi')) {
      return KNOWN_RESCUE_PARTNERS.parc
    }
    if (city.includes('karachi')) {
      return KNOWN_RESCUE_PARTNERS.tosc
    }
    return KNOWN_RESCUE_PARTNERS.parc
  }

  return null
}

export interface TrackingNotice {
  type: 'fresh' | 'queued' | 'extended' | 'active' | 'resolved'
  headline: string
  body: string
  subtext?: string
  advocacyNote?: string
}

/**
 * Generates transparent status guidance, thanking the reporter, contextualizing
 * resource limits without charity/donation buzzwords, and emphasizing legal advocacy value.
 */
export function getTrackingNotice(report?: Record<string, any> | null): TrackingNotice {
  if (!report) {
    return {
      type: 'fresh',
      headline: 'Report under review',
      body: 'Your report is being reviewed across the rescue network.',
    }
  }

  const status = String(report.status || 'logged').toLowerCase()
  const isResolved =
    status === 'resolved' ||
    status === 'completed' ||
    status === 'admitted_shelter' ||
    status === 'spot_released'

  if (isResolved) {
    return {
      type: 'resolved',
      headline: 'Rescue case completed',
      body: 'This rescue report has been attended and resolved by the responding unit. Thank you for being the eyes and voice that made this intervention possible.',
      advocacyNote:
        'Case records and clinical outcomes are preserved as verified evidence for animal protection legal archives and municipal reform.',
    }
  }

  if (status === 'dispatched' || status === 'attended') {
    return {
      type: 'active',
      headline: 'Rescue team mobilized',
      body: 'A rescue team is actively on the move or attending to this animal in the field. Thank you for taking action and staying connected.',
      subtext: 'Please keep your phone accessible in case the field team requires precise location guidance.',
    }
  }

  if (status === 'accepted') {
    return {
      type: 'active',
      headline: 'Case accepted by rescue team',
      body: 'A responding rescue unit has claimed this case and is coordinating vehicle dispatch based on emergency triage priority.',
      subtext: 'Thank you for your patience while the team prepares transport and clinical intake arrangements.',
    }
  }

  // Otherwise, case is in 'logged' status
  const loggedTime = new Date(report.stage_logged_at || report.created_at || Date.now()).getTime()
  const now = Date.now()
  const elapsedHours = isNaN(loggedTime) ? 0 : Math.max(0, (now - loggedTime) / (1000 * 60 * 60))

  if (elapsedHours < 2) {
    return {
      type: 'fresh',
      headline: 'Thank you for reporting this emergency',
      body: 'Your case is logged across the rescue network and responders are reviewing details. Please note that rescue teams and public institutions operate with limited vehicles and emergency capacity, prioritizing critical, life-threatening cases first.',
      subtext:
        'If the animal is in immediate traffic danger, offering water or keeping a watchful eye from a safe distance helps safeguard them while responders coordinate.',
    }
  }

  if (elapsedHours < 12) {
    return {
      type: 'queued',
      headline: 'Thank you for your continued patience',
      body: 'Your case remains active in the network dispatch queue. Responders operate under high daily case volumes and strict vehicle constraints. If you can safely offer the animal clean water, shade, or temporary containment nearby, that provides immediate relief while field teams mobilize.',
      subtext: 'Response times depend on vehicle availability and trauma severity triage across the city.',
    }
  }

  // Extended delay (> 12 hours)
  return {
    type: 'extended',
    headline: 'Still awaiting an available rescue unit',
    body: 'Across Pakistan, response units and institutional shelters face severe vehicle and facility shortages, and not every case can be reached immediately.',
    subtext:
      'If you can safely assist with transport to a nearby veterinary clinic or temporary foster care, that can directly save this animal.',
    advocacyNote:
      'Your report is already making a difference: Every logged case provides documented ground data to our partner animal rights lawyers and policy advocates advocating for stronger animal protection legislation, municipal rescue infrastructure, and public funding.',
  }
}
