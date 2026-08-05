import { useEffect, useState } from 'react'

type MoraleToastProps = {
  message: string | null
  onDone?: () => void
  durationMs?: number
}

export function MoraleToast({
  message,
  onDone,
  durationMs = 2800,
}: MoraleToastProps) {
  const [visible, setVisible] = useState(Boolean(message))

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }
    setVisible(true)
    const t = window.setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, durationMs)
    return () => window.clearTimeout(t)
  }, [message, durationMs, onDone])

  if (!visible || !message) return null
  return (
    <div className="morale-toast" role="status">
      {message}
    </div>
  )
}
