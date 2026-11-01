import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export type ReportLocationMapProps = {
  latitude: number
  longitude: number
  landmark?: string | null
  areaName?: string | null
  isCentroid?: boolean
  className?: string
  interactive?: boolean
  onMapClick?: () => void
}

export function ReportLocationMap({
  latitude,
  longitude,
  landmark,
  areaName,
  isCentroid = false,
  className = '',
  interactive = false,
  onMapClick,
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
        zoom: isCentroid ? 14 : 15,
        zoomControl: true,
        attributionControl: false, // Removes all OSM bottom text, credits, and donation links
        scrollWheelZoom: interactive,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: interactive,
      })
      mapInstance = map

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Classic teardrop pointed map pin matching OpenStreetMap classic marker
      const pinIcon = L.divIcon({
        className: 'custom-sanctuary-pointed-pin',
        html: `
          <div style="position: relative; width: 25px; height: 41px;">
            <svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
              <path d="M12.5 40L2.94 21.6448C1.47 18.8224 0 16 0 12.5C0 5.59644 5.59644 0 12.5 0C19.4036 0 25 5.59644 25 12.5C25 16 23.53 18.8224 22.06 21.6448L12.5 40Z" fill="#e03131" stroke="#b91c1c" stroke-width="1.2"/>
              <circle cx="12.5" cy="12.5" r="4.5" fill="#ffffff"/>
            </svg>
          </div>
        `,
        iconSize: [25, 41],
        iconAnchor: [12.5, 40],
        popupAnchor: [0, -36],
      })

      const marker = L.marker([latitude, longitude], { icon: pinIcon }).addTo(map)
      const popupText = landmark || areaName || (isCentroid ? 'Area Centroid' : 'Rescue Location')
      marker.bindPopup(`<strong>${popupText}</strong>`)

      // If coordinates are an area centroid, render a neighborhood boundary marking
      if (isCentroid) {
        const zoneCircle = L.circle([latitude, longitude], {
          radius: 650, // ~650m neighborhood radius
          color: '#e03131',
          weight: 2,
          dashArray: '5, 6',
          fillColor: '#e03131',
          fillOpacity: 0.14,
        }).addTo(map)

        if (areaName || landmark) {
          zoneCircle.bindTooltip(`Area Zone: ${areaName || landmark}`, {
            direction: 'top',
            offset: [0, -10],
          })
        }

        map.fitBounds(zoneCircle.getBounds(), {
          padding: [20, 20],
          maxZoom: 15,
        })
      }

      if (onMapClick) {
        map.on('click', () => {
          onMapClick()
        })
      }

      // Ensure proper tile rendering after container layout
      setTimeout(() => {
        if (isMounted && mapInstance) {
          mapInstance.invalidateSize()
        }
      }, 150)
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
  }, [latitude, longitude, landmark, areaName, isCentroid, interactive, onMapClick])

  return (
    <div
      ref={containerRef}
      className={`location-map-canvas ${className}`}
      data-testid="location-map-canvas"
      aria-label="Rescue location map"
      role="region"
      onClick={onMapClick}
    />
  )
}
