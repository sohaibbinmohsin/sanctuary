import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export type ReportLocationMapProps = {
  latitude: number
  longitude: number
  landmark?: string | null
  className?: string
}

export function ReportLocationMap({
  latitude,
  longitude,
  landmark,
  className = '',
}: ReportLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    let isMounted = true
    let mapInstance: any = null

    import('leaflet').then((leafletModule) => {
      if (!isMounted || !containerRef.current) return
      const L = (leafletModule as any).default || leafletModule

      // Prevent re-initialization if container already has a map
      if ((containerRef.current as any)._leaflet_id) {
        return
      }

      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 15,
        zoomControl: true,
        attributionControl: false, // Removes all OSM bottom text, credits, and donation links
        scrollWheelZoom: false,
      })
      mapInstance = map

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Custom Sanctuary pin marker with brand styling
      const pinIcon = L.divIcon({
        className: 'custom-sanctuary-map-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: #de6b2b;
            color: #ffffff;
            box-shadow: 0 3px 10px rgba(222, 107, 43, 0.45), 0 0 0 3px #ffffff;
            transform: translate(-50%, -50%);
          ">
            <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
              <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,112a24,24,0,1,1,24-24A24,24,0,0,1,128,128Z"/>
            </svg>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [0, 0],
      })

      const marker = L.marker([latitude, longitude], { icon: pinIcon }).addTo(map)
      if (landmark) {
        marker.bindPopup(`<strong>${landmark}</strong>`)
      }
    }).catch((err) => {
      console.warn('Leaflet map initialization failed:', err)
    })

    return () => {
      isMounted = false
      if (mapInstance) {
        mapInstance.remove()
        mapInstance = null
      }
    }
  }, [latitude, longitude, landmark])

  return (
    <div
      ref={containerRef}
      className={`location-map-canvas ${className}`}
      data-testid="location-map-canvas"
      aria-label="Rescue location map"
      role="region"
    />
  )
}
