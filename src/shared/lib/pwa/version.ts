export const LOCAL_BUILD =
  typeof __SANCTUARY_BUILD__ === 'string' ? __SANCTUARY_BUILD__ : ''

export type RemoteBuildInfo = {
  version: string
  critical: boolean
}

type VersionPayload = {
  version?: unknown
  critical?: unknown
}

export async function readRemoteBuildVersion(
  load: () => Promise<unknown> = async () => {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) throw new Error('version fetch failed')
    return res.json()
  },
): Promise<RemoteBuildInfo | null> {
  try {
    const data = (await load()) as VersionPayload
    return typeof data?.version === 'string' && data.version.length > 0
      ? {
          version: data.version,
          critical: Boolean(data.critical),
        }
      : null
  } catch {
    return null
  }
}

export function hasAppUpdate(
  remote: RemoteBuildInfo | string | null,
  local: string = LOCAL_BUILD,
): boolean {
  const remoteVersion =
    typeof remote === 'object' && remote !== null ? remote.version : remote
  return Boolean(remoteVersion && local && remoteVersion !== local)
}

