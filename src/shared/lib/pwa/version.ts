export const LOCAL_BUILD =
  typeof __SANCTUARY_BUILD__ === 'string' ? __SANCTUARY_BUILD__ : ''

type VersionPayload = {
  version?: unknown
}

export async function readRemoteBuildVersion(
  load: () => Promise<unknown> = async () => {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) throw new Error('version fetch failed')
    return res.json()
  },
): Promise<string | null> {
  try {
    const data = (await load()) as VersionPayload
    return typeof data?.version === 'string' && data.version.length > 0
      ? data.version
      : null
  } catch {
    return null
  }
}

export function hasAppUpdate(
  remote: string | null,
  local: string = LOCAL_BUILD,
): boolean {
  return Boolean(remote && local && remote !== local)
}
