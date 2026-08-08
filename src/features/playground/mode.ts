/** Set once at app boot. Prefer this over re-parsing the URL. */
let playgroundActive = false

export function setPlaygroundMode(active: boolean): void {
  playgroundActive = active
}

export function isPlaygroundMode(): boolean {
  return playgroundActive
}

export function isPlaygroundPath(pathname: string): boolean {
  return pathname === '/playground' || pathname.startsWith('/playground/')
}

/** Stable IDs so re-seed / reset stay consistent. */
export const PLAYGROUND_ORG_ID = 'a1111111-1111-4111-8111-111111111111'
export const PLAYGROUND_USER_ID = 'a2222222-2222-4222-8222-222222222222'
export const PLAYGROUND_MEMBER_ID = 'a3333333-3333-4333-8333-333333333333'

export const PLAYGROUND_ORG_NAME = 'Playground sanctuary'
export const PLAYGROUND_ORG_INITIALS = 'PLAY'
