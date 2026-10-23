import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, X, Camera, Crosshair, MapPin, Compass, CircleNotch, Trash } from '@phosphor-icons/react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { TextField, TextareaField } from '@/shared/ui/Field'
import { SelectField } from '@/shared/ui/SelectField'
import { AutocompleteField } from '@/shared/ui/AutocompleteField'
import {
  IntakePhotoPicker,
  type StagedPhoto,
} from '@/features/animals/components/IntakePhotoPicker'
import {
  createRescueReport,
  updateRescueReport,
  getRescueReportById,
  generateReportNumber,
  addReportPhoto,
  getPhotosForReport,
  deleteReportPhoto,
  formatPhoneNumber,
  validatePhoneNumber,
  formatCnic,
  validateCnic,
  formatCoordinates,
  getNavigationUrl,
  requestCurrentPosition,
  parseCoordinates,
  searchFrequentCallers,
  PAKISTAN_CITIES,
  getAreasForCity,
  AVIAN_PRESETS,
  type IntakeSource,
  type FrequentCaller,
  type ReportPhoto,
  type RescueReport,
} from '@/features/reports/domain/rescueReports'
import { getLocalPhoto } from '@/features/photos/domain/photos'
import { publicPhotoUrl } from '@/shared/lib/r2/upload'

const SPECIES_PRESETS = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other'] as const

const CATEGORY_OPTIONS = [
  { value: 'emergency', label: 'Medical emergency' },
  { value: 'cruelty', label: 'Animal cruelty' },
] as const

const INTAKE_SOURCES: { value: IntakeSource; label: string }[] = [
  { value: 'citizen', label: 'Citizen Call' },
  { value: 'rescue_1122', label: 'Rescue 1122' },
  { value: 'field_patrol', label: 'Field Patrol (Self)' },
  { value: 'partner_transfer', label: 'Partner Transfer' },
]

export function ReportIntakeScreen() {
  const db = useDb()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const { member } = useCurrentMember()

  const [existingReport, setExistingReport] = useState<RescueReport | null>(null)
  const [existingPhotos, setExistingPhotos] = useState<ReportPhoto[]>([])
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<Record<string, string>>({})
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([])
  const [loadingInitial, setLoadingInitial] = useState(isEditMode)

  const [category, setCategory] = useState<string>('emergency')
  const [intakeCountMode, setIntakeCountMode] = useState<'single' | 'litter' | 'multiple'>('single')
  const [litterComposition, setLitterComposition] = useState<'offspring_only' | 'mother_and_offspring'>('offspring_only')
  const [groupRows, setGroupRows] = useState<Array<{
    id: string
    species: string
    avianSubtype?: string
    lifeStage?: 'adult' | 'child'
  }>>([
    { id: '1', species: 'Dog', lifeStage: 'adult' },
    { id: '2', species: 'Cat', lifeStage: 'child' },
  ])
  const [speciesPreset, setSpeciesPreset] = useState<string>('Dog')
  const [speciesOther, setSpeciesOther] = useState('')
  const [avianSubtype, setAvianSubtype] = useState<string>('')
  const [animalCount, setAnimalCount] = useState<number>(1)
  const [lifeStage, setLifeStage] = useState<'adult' | 'child'>('adult')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [city, setCity] = useState('Lahore')
  const [locationArea, setLocationArea] = useState('')
  const [locationLandmark, setLocationLandmark] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationLinkInput, setLocationLinkInput] = useState('')
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [intakeSource, setIntakeSource] = useState<IntakeSource>('citizen')
  const [reporterName, setReporterName] = useState('')
  const [reporterPhone, setReporterPhone] = useState('')
  const [reporterCnic, setReporterCnic] = useState('')
  const [callerSuggestions, setCallerSuggestions] = useState<FrequentCaller[]>([])
  const [showCallerDropdown, setShowCallerDropdown] = useState(false)
  const [legalNotes, setLegalNotes] = useState('')
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)


  const orgId = member?.orgId ?? existingReport?.org_id ?? ''
  const orgInitials = member?.orgInitials ?? 'SANCTUARY'

  useEffect(() => {
    if (!db || !id) return
    let cancelled = false
    async function loadData() {
      try {
        const report = await getRescueReportById(db, id!)
        if (cancelled || !report) return
        setExistingReport(report)
        setCategory(report.category || 'emergency')
        setIntakeSource((report.intake_source as IntakeSource) || 'citizen')
        setAnimalCount(report.animal_count && report.animal_count > 0 ? report.animal_count : 1)

        if (report.group_breakdown) {
          try {
            const parsed = JSON.parse(report.group_breakdown)
            if (Array.isArray(parsed) && parsed.length > 0) {
              const isLitter =
                parsed.length <= 2 &&
                parsed.every(
                  (p: any) =>
                    p.species &&
                    p.species.toLowerCase() === (report.species || '').toLowerCase(),
                ) &&
                Boolean(report.animal_count && report.animal_count > 1)
              if (isLitter) {
                setIntakeCountMode('litter')
                const hasAdult = parsed.some((p: any) => p.lifeStage === 'adult')
                setLitterComposition(hasAdult ? 'mother_and_offspring' : 'offspring_only')
              } else {
                setIntakeCountMode('multiple')
                const flattened: Array<{
                  id: string
                  species: string
                  avianSubtype?: string
                  lifeStage?: 'adult' | 'child'
                }> = []
                parsed.forEach((p: any, idx: number) => {
                  const count = Math.max(1, p.count || 1)
                  const speciesStr = p.species
                    ? p.species.charAt(0).toUpperCase() + p.species.slice(1)
                    : 'Dog'
                  for (let c = 0; c < count; c++) {
                    flattened.push({
                      id: c === 0 && p.id ? p.id : `${idx + 1}-${c + 1}`,
                      species: speciesStr,
                      avianSubtype: p.avianSubtype || undefined,
                      lifeStage: p.lifeStage || 'adult',
                    })
                  }
                })
                setGroupRows(flattened.length > 0 ? flattened : [{ id: '1', species: 'Dog', lifeStage: 'adult' }])
              }
            }
          } catch (e) {
            console.warn('Failed to parse group_breakdown', e)
          }
        } else if (report.animal_count && report.animal_count > 1) {
          setIntakeCountMode('litter')
        }

        const speciesLower = (report.species || '').toLowerCase()
        const matchedAvian = AVIAN_PRESETS.find((p) => p.toLowerCase() === speciesLower)
        if (matchedAvian) {
          setSpeciesPreset('Bird')
          setAvianSubtype(matchedAvian)
        } else if (speciesLower === 'bird') {
          setSpeciesPreset('Bird')
          setAvianSubtype('Other Bird')
        } else {
          const speciesCap = report.species
            ? report.species.charAt(0).toUpperCase() + report.species.slice(1).toLowerCase()
            : 'Other'
          if ((SPECIES_PRESETS as readonly string[]).includes(speciesCap)) {
            setSpeciesPreset(speciesCap)
          } else {
            setSpeciesPreset('Other')
            setSpeciesOther(report.species || '')
          }
        }
        setLifeStage((report.life_stage as 'adult' | 'child') || 'adult')
        setChiefComplaint(report.chief_complaint || '')
        setCity(report.city || 'Lahore')
        setLocationArea(report.location_area || '')
        setLocationLandmark(report.location_landmark || '')
        setLatitude(report.latitude ?? null)
        setLongitude(report.longitude ?? null)
        setReporterName(report.reporter_name || '')
        setReporterPhone(report.reporter_phone ? formatPhoneNumber(report.reporter_phone) : '')
        setReporterCnic(report.reporter_cnic ? formatCnic(report.reporter_cnic) : '')
        setLegalNotes(report.legal_notes || '')

        // Load existing photos
        const photos = await getPhotosForReport(db, id!)
        if (cancelled) return
        setExistingPhotos(photos)
        const urls: Record<string, string> = {}
        for (const p of photos) {
          const blob = await getLocalPhoto(p.id)
          if (blob) {
            urls[p.id] = URL.createObjectURL(blob)
          } else if (p.r2_key) {
            const pub = publicPhotoUrl(p.r2_key)
            if (pub) urls[p.id] = pub
          }
        }
        setExistingPhotoUrls(urls)
      } catch (err) {
        console.error('Failed to load report for editing', err)
      } finally {
        if (!cancelled) setLoadingInitial(false)
      }
    }
    void loadData()
    return () => {
      cancelled = true
    }
  }, [db, id])

  useEffect(() => {
    if (!db || !orgId) return
    const query = (reporterPhone || reporterName).trim()
    if (query.length < 2) {
      if (callerSuggestions.length > 0) setCallerSuggestions([])
      if (showCallerDropdown) setShowCallerDropdown(false)
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      try {
        const results = await searchFrequentCallers(db, orgId, query)
        if (active) {
          setCallerSuggestions(results)
          setShowCallerDropdown(results.length > 0)
        }
      } catch {
        if (active) {
          setCallerSuggestions([])
          setShowCallerDropdown(false)
        }
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [db, orgId, reporterPhone, reporterName, callerSuggestions.length, showCallerDropdown])

  function handleSelectCaller(caller: FrequentCaller) {
    if (caller.name) setReporterName(caller.name)
    if (caller.phone) setReporterPhone(formatPhoneNumber(caller.phone))
    if (caller.cnic) setReporterCnic(formatCnic(caller.cnic))
    if (caller.area) setLocationArea(caller.area)
    setShowCallerDropdown(false)
  }

  const phoneValidation = validatePhoneNumber(reporterPhone)
  const cnicValidation = validateCnic(reporterCnic)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!db || !orgId) {
      setError('Database or organization not ready.')
      return
    }

    const complaintTrimmed = chiefComplaint.trim()
    const cityTrimmed = city.trim() || 'Lahore'
    const areaTrimmed = locationArea.trim()

    if (!complaintTrimmed) {
      setError('Please provide a chief complaint or injury description.')
      return
    }

    if (!areaTrimmed) {
      setError('Please provide a location area.')
      return
    }

    if (reporterPhone.trim() && !phoneValidation.isValid) {
      setError(phoneValidation.error || 'Please enter a valid phone number (e.g. 0300 1234567).')
      return
    }

    if (intakeSource === 'citizen' && reporterCnic.trim() && !cnicValidation.isValid) {
      setError(cnicValidation.error || 'Please enter a valid 13-digit CNIC (e.g. 42101-1234567-1).')
      return
    }

    setSubmitting(true)
    setError(null)

    let effectiveCount = 1
    let calculatedSpecies =
      speciesPreset === 'Bird'
        ? avianSubtype ? avianSubtype.toLowerCase() : 'bird'
        : speciesPreset === 'Other'
          ? speciesOther.trim() || 'Other'
          : speciesPreset
    let effectiveLifeStage: 'adult' | 'child' | null = lifeStage
    let groupBreakdownJson: string | null = null

    if (intakeCountMode === 'single') {
      effectiveCount = 1
      effectiveLifeStage = lifeStage
      groupBreakdownJson = null
    } else if (intakeCountMode === 'litter') {
      effectiveCount = Math.max(2, animalCount)
      if (litterComposition === 'mother_and_offspring') {
        effectiveLifeStage = 'adult'
        groupBreakdownJson = JSON.stringify([
          { id: 'mother', count: 1, species: calculatedSpecies.toLowerCase(), lifeStage: 'adult' },
          {
            id: 'litter',
            count: Math.max(1, effectiveCount - 1),
            species: calculatedSpecies.toLowerCase(),
            lifeStage: 'child',
          },
        ])
      } else {
        effectiveLifeStage = 'child'
        groupBreakdownJson = JSON.stringify([
          { id: 'litter', count: effectiveCount, species: calculatedSpecies.toLowerCase(), lifeStage: 'child' },
        ])
      }
    } else if (intakeCountMode === 'multiple') {
      effectiveCount = groupRows.length
      effectiveLifeStage = null
      const uniqueSpecies = Array.from(new Set(groupRows.map((r) => r.species.toLowerCase())))
      calculatedSpecies = uniqueSpecies.length === 1 ? uniqueSpecies[0] : 'mixed'
      groupBreakdownJson = JSON.stringify(
        groupRows.map((r) => ({
          id: r.id,
          count: 1,
          species:
            r.species === 'Bird' && r.avianSubtype
              ? r.avianSubtype.toLowerCase()
              : r.species.toLowerCase(),
          lifeStage: r.lifeStage || null,
          avianSubtype: r.species === 'Bird' ? r.avianSubtype || null : null,
        })),
      )
    }

    try {
      if (isEditMode && id) {
        // Update details ONLY - preserve timeline milestones, stage, and disposition
        await updateRescueReport(db, id, {
          category,
          species: calculatedSpecies.toLowerCase(),
          lifeStage: effectiveLifeStage,
          chiefComplaint: complaintTrimmed,
          city: cityTrimmed,
          locationArea: areaTrimmed,
          locationLandmark: locationLandmark.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          reporterName: reporterName.trim() || null,
          reporterPhone: reporterPhone.trim() ? formatPhoneNumber(reporterPhone) : null,
          reporterCnic: reporterCnic.trim()
            ? intakeSource === 'citizen' || intakeSource === 'field_patrol'
              ? formatCnic(reporterCnic)
              : reporterCnic.trim()
            : null,
          legalNotes: legalNotes.trim() || null,
          intakeSource,
          animalCount: Math.max(1, effectiveCount),
          groupBreakdown: groupBreakdownJson,
        })

        // Delete any marked photos
        for (const photoId of photosToDelete) {
          await deleteReportPhoto(db, photoId)
        }

        // Add any newly staged photos
        if (stagedPhotos.length > 0) {
          const now = new Date().toISOString()
          for (const photo of stagedPhotos) {
            await addReportPhoto(db, {
              orgId,
              reportId: id,
              blob: photo.blob,
            })
            if (existingReport?.animal_id) {
              try {
                await db.execute(
                  `INSERT INTO photos (id, org_id, animal_id, r2_key, local_only, upload_state, capture_source, verified, created_at)
                   VALUES (?, ?, ?, NULL, 1, 'pending', 'upload', 0, ?)`,
                  [crypto.randomUUID(), orgId, existingReport.animal_id, now],
                )
              } catch (photoErr) {
                console.warn('Could not mirror photo to animal', photoErr)
              }
            }
          }
        }

        navigate(`/reports/${id}`, { replace: true })
      } else {
        const reportNumber = await generateReportNumber(db, orgInitials)
        const report = await createRescueReport(db, {
          orgId,
          reportNumber,
          category,
          species: calculatedSpecies.toLowerCase(),
          lifeStage: effectiveLifeStage,
          chiefComplaint: complaintTrimmed,
          city: cityTrimmed,
          locationArea: areaTrimmed,
          locationLandmark: locationLandmark.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          reporterName: reporterName.trim() || null,
          reporterPhone: reporterPhone.trim() ? formatPhoneNumber(reporterPhone) : null,
          reporterCnic: reporterCnic.trim()
            ? intakeSource === 'citizen' || intakeSource === 'field_patrol'
              ? formatCnic(reporterCnic)
              : reporterCnic.trim()
            : null,
          intakeSource,
          animalCount: Math.max(1, effectiveCount),
          groupBreakdown: groupBreakdownJson,
        })

        // Attach any staged photos to this report
        if (stagedPhotos.length > 0) {
          for (const photo of stagedPhotos) {
            await addReportPhoto(db, {
              orgId,
              reportId: report.id,
              blob: photo.blob,
            })
          }
        }

        navigate(`/reports/${report.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rescue report.')
      setSubmitting(false)
    }
  }

  function handleAddPhotos(newPhotos: StagedPhoto[]) {
    setStagedPhotos((prev) => [...prev, ...newPhotos])
  }

  function handleRemovePhoto(photoId: string) {
    setStagedPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  if (loadingInitial) {
    return (
      <section className="screen">
        <PageHeader
          backTo={id ? `/reports/${id}` : '/reports'}
          backLabel={id ? 'Report' : 'Reports'}
          title="Edit rescue report"
          subtitle="Loading report details…"
        />
        <p className="loading-state">Loading report details…</p>
      </section>
    )
  }

  return (
    <section className="screen screen--sticky-footer">
      <PageHeader
        backTo={isEditMode ? `/reports/${id}` : '/reports'}
        backLabel={isEditMode ? 'Report' : 'Reports'}
        title={
          isEditMode
            ? existingReport?.report_number
              ? `Edit Report ${existingReport.report_number}`
              : 'Edit rescue report'
            : 'Log a rescue report'
        }
        subtitle={
          isEditMode
            ? 'Update report details, location, or attach proof photos.'
            : 'Record incoming emergency and dispatch rescue team.'
        }
      />

      <form className="stack stack--loose" onSubmit={handleSubmit}>
        {/* 1. Animal Category & Species */}
        <div className="panel stack">
          <p className="section-label">Report Category &amp; Animal</p>

          <div className="field">
            <span>Category</span>
            <div className="filter-chips" role="group" aria-label="Report category">
              {CATEGORY_OPTIONS.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className="chip"
                  aria-pressed={category === item.value}
                  onClick={() => setCategory(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Intake Mode (Single / Litter / Multiple) - Appears BEFORE Species */}
          <div className="field">
            <span>Animal Count &amp; Composition</span>
            <div className="filter-chips" role="group" aria-label="Animal count mode">
              <button
                type="button"
                className="chip"
                aria-pressed={intakeCountMode === 'single'}
                onClick={() => {
                  setIntakeCountMode('single')
                  setAnimalCount(1)
                }}
              >
                Single Animal
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={intakeCountMode === 'litter'}
                onClick={() => {
                  setIntakeCountMode('litter')
                  if (animalCount <= 1) setAnimalCount(4)
                }}
              >
                Litter / Family
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={intakeCountMode === 'multiple'}
                onClick={() => {
                  setIntakeCountMode('multiple')
                  if (groupRows.length === 0) {
                    setGroupRows([
                      { id: '1', species: 'Dog', lifeStage: 'adult' },
                      { id: '2', species: 'Cat', lifeStage: 'child' },
                    ])
                  }
                }}
              >
                Multiple Animals / Mixed
              </button>
            </div>
          </div>

          {/* Mode: SINGLE */}
          {intakeCountMode === 'single' ? (
            <>
              <div className="field">
                <span>Species</span>
                <div className="filter-chips" role="group" aria-label="Animal species">
                  {SPECIES_PRESETS.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className="chip"
                      aria-pressed={speciesPreset === item}
                      onClick={() => {
                        setSpeciesPreset(item)
                        if (item !== 'Bird') setAvianSubtype('')
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {speciesPreset === 'Bird' ? (
                <div className="field">
                  <span>Avian Sub-type</span>
                  <div className="filter-chips" role="group" aria-label="Avian species">
                    {AVIAN_PRESETS.map((item) => (
                      <button
                        type="button"
                        key={item}
                        className="chip"
                        aria-pressed={avianSubtype === item}
                        onClick={() => setAvianSubtype(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {speciesPreset === 'Other' ? (
                <TextField
                  label="Custom species"
                  placeholder="e.g. Goat, Falcon, Rabbit"
                  value={speciesOther}
                  onChange={(e) => setSpeciesOther(e.target.value)}
                  required
                />
              ) : null}

              {/* Life Stage is visible in Single mode */}
              <div className="stack stack--tight">
                <span className="field__label">Life stage</span>
                <div className="segmented" role="group" aria-label="Life stage">
                  {(
                    [
                      { value: 'adult', label: 'Adult' },
                      { value: 'child', label: 'Child' },
                    ] as const
                  ).map((stage) => (
                    <button
                      key={stage.value}
                      type="button"
                      className="segmented__btn"
                      aria-pressed={lifeStage === stage.value}
                      onClick={() => setLifeStage(stage.value)}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {/* Mode: LITTER */}
          {intakeCountMode === 'litter' ? (
            <>
              {/* Stepper for litter count */}
              <div className="field stack stack--tight">
                <label htmlFor="animal-count-input" className="field__label">
                  Total in litter
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="segmented__btn"
                    style={{ width: '40px', height: '40px', padding: 0, fontSize: '18px', fontWeight: 'bold' }}
                    onClick={() => setAnimalCount((prev) => Math.max(2, prev - 1))}
                    disabled={animalCount <= 2}
                    aria-label="Decrease count"
                  >
                    -
                  </button>
                  <input
                    id="animal-count-input"
                    aria-label="Animal count"
                    type="number"
                    inputMode="numeric"
                    className="input-no-spinner"
                    min={2}
                    max={50}
                    value={animalCount < 2 ? 4 : animalCount}
                    onChange={(e) => setAnimalCount(Math.max(2, parseInt(e.target.value, 10) || 2))}
                    style={{
                      width: '64px',
                      textAlign: 'center',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-sans)',
                    }}
                  />
                  <button
                    type="button"
                    className="segmented__btn"
                    style={{ width: '40px', height: '40px', padding: 0, fontSize: '18px', fontWeight: 'bold' }}
                    onClick={() => setAnimalCount((prev) => prev + 1)}
                    aria-label="Increase count"
                  >
                    +
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-brand, #de6b2b)' }}>
                    Litter of {animalCount < 2 ? 4 : animalCount}
                  </span>
                </div>
              </div>

              {/* Species chips for litter */}
              <div className="field">
                <span>Species</span>
                <div className="filter-chips" role="group" aria-label="Animal species">
                  {SPECIES_PRESETS.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className="chip"
                      aria-pressed={speciesPreset === item}
                      onClick={() => {
                        setSpeciesPreset(item)
                        if (item !== 'Bird') setAvianSubtype('')
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {speciesPreset === 'Bird' ? (
                <div className="field">
                  <span>Avian Sub-type</span>
                  <div className="filter-chips" role="group" aria-label="Avian species">
                    {AVIAN_PRESETS.map((item) => (
                      <button
                        type="button"
                        key={item}
                        className="chip"
                        aria-pressed={avianSubtype === item}
                        onClick={() => setAvianSubtype(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Composition tags: Offspring only vs Mother + Offspring */}
              <div className="field stack stack--tight">
                <span className="field__label">Litter Composition</span>
                <div className="filter-chips" role="group" aria-label="Litter composition">
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={litterComposition === 'offspring_only'}
                    onClick={() => setLitterComposition('offspring_only')}
                  >
                    Babies only
                  </button>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={litterComposition === 'mother_and_offspring'}
                    onClick={() => setLitterComposition('mother_and_offspring')}
                  >
                    Mother + {Math.max(1, (animalCount < 2 ? 4 : animalCount) - 1)} Babies
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {/* Mode: MULTIPLE ANIMALS / MIXED */}
          {intakeCountMode === 'multiple' ? (
            <div className="field stack stack--tight">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="field__label">Animals in Group / Scene</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-brand, #de6b2b)' }}>
                  Total: {groupRows.length} {groupRows.length === 1 ? 'animal' : 'animals'}
                </span>
              </div>

              <div className="group-roster-list stack stack--tight">
                {groupRows.map((row, idx) => (
                  <div key={row.id} className="group-roster-row">
                    {/* Species selector */}
                    <div style={{ flex: '1 1 120px', minWidth: '105px' }}>
                      <SelectField
                        label={`Animal ${idx + 1} species`}
                        hideLabel
                        value={row.species}
                        options={SPECIES_PRESETS.map((sp) => ({ value: sp, label: sp }))}
                        onChange={(val) => {
                          setGroupRows((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, species: val, avianSubtype: val === 'Bird' ? 'Black Kite' : undefined }
                                : r,
                            ),
                          )
                        }}
                      />
                    </div>

                    {/* Avian sub-type if Bird */}
                    {row.species === 'Bird' ? (
                      <div style={{ flex: '1 1 130px', minWidth: '115px' }}>
                        <SelectField
                          label={`Animal ${idx + 1} avian subtype`}
                          hideLabel
                          value={row.avianSubtype || 'Other Bird'}
                          options={AVIAN_PRESETS.map((av) => ({ value: av, label: av }))}
                          onChange={(val) => {
                            setGroupRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, avianSubtype: val } : r)),
                            )
                          }}
                        />
                      </div>
                    ) : null}

                    {/* Life stage selector */}
                    <div style={{ flex: '1 1 120px', minWidth: '105px' }}>
                      <SelectField
                        label={`Animal ${idx + 1} life stage`}
                        hideLabel
                        value={row.lifeStage || 'adult'}
                        options={[
                          { value: 'adult', label: 'Adult' },
                          { value: 'child', label: 'Child / Baby' },
                        ]}
                        onChange={(val) => {
                          setGroupRows((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, lifeStage: val as 'adult' | 'child' } : r,
                            ),
                          )
                        }}
                      />
                    </div>

                    {/* Delete row button */}
                    {groupRows.length > 1 ? (
                      <button
                        type="button"
                        className="group-roster-delete-btn"
                        onClick={() => {
                          setGroupRows((prev) => prev.filter((_, i) => i !== idx))
                        }}
                        aria-label="Remove animal"
                      >
                        <Trash size={18} weight="bold" />
                      </button>
                    ) : null}
                  </div>
                ))}

                <button
                  type="button"
                  className="pressable"
                  onClick={() => {
                    setGroupRows((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        species: 'Dog',
                        lifeStage: 'adult',
                      },
                    ])
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border)',
                    background: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-brand, #de6b2b)',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  + Add another animal / species
                </button>
              </div>
            </div>
          ) : null}

          <TextareaField
            label="Chief complaint / Injury"
            placeholder="e.g. Hit by rickshaw • Fractured rear leg & bleeding"
            rows={3}
            value={chiefComplaint}
            onChange={(e) => {
              setChiefComplaint(e.target.value)
              if (error) setError(null)
            }}
            required
          />
        </div>

        {/* 2. Intake Source & Reporter (Moved before Location) */}
        <div className="panel stack" style={{ position: 'relative' }}>
          <p className="section-label">Intake Source &amp; Reporter</p>

          <div className="field">
            <span>Intake Source</span>
            <div className="filter-chips" role="group" aria-label="Intake source">
              {INTAKE_SOURCES.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className="chip"
                  aria-pressed={intakeSource === item.value}
                  onClick={() => setIntakeSource(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Phone Field (First) */}
          <div className="field stack stack--tight" style={{ position: 'relative' }}>
            <TextField
              label={
                intakeSource === 'rescue_1122'
                  ? 'Contact Phone'
                  : intakeSource === 'field_patrol'
                    ? 'Rescuer Contact Phone'
                    : intakeSource === 'partner_transfer'
                      ? 'Partner Contact Phone'
                      : 'Phone'
              }
              hint="optional"
              type="tel"
              placeholder={
                intakeSource === 'rescue_1122'
                  ? 'e.g. 042 99231122 or mobile'
                  : 'e.g. 0300 1234567'
              }
              value={reporterPhone}
              onChange={(e) => {
                setReporterPhone(formatPhoneNumber(e.target.value))
                setShowCallerDropdown(true)
                if (error) setError(null)
              }}
              onFocus={() => {
                if (callerSuggestions.length > 0) setShowCallerDropdown(true)
              }}
            />
            {reporterPhone.trim() ? (
              phoneValidation.isValid ? (
                <span
                  className="field__hint"
                  style={{
                    color: 'var(--color-forest)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 500,
                  }}
                >
                  <Check size={14} weight="bold" /> Valid phone number
                </span>
              ) : (
                <span
                  className="field__hint"
                  style={{ color: 'var(--color-amber)', fontWeight: 500 }}
                >
                  {phoneValidation.error}
                </span>
              )
            ) : null}

            {/* Frequent Callers Suggestions Dropdown */}
            {showCallerDropdown && callerSuggestions.length > 0 ? (
              <div className="frequent-callers-dropdown">
                {callerSuggestions.map((caller, idx) => (
                  <button
                    key={`${caller.phone}-${caller.name}-${idx}`}
                    type="button"
                    className="frequent-caller-item"
                    onClick={() => handleSelectCaller(caller)}
                  >
                    <span className="frequent-caller-star">★</span>
                    <strong>{caller.name || 'Anonymous'}</strong>
                    <span>·</span>
                    <span>
                      {caller.count} past rescue{caller.count === 1 ? '' : 's'}
                    </span>
                    {caller.area ? <span>({caller.area})</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Caller / Rescuer Name with Suggestions (Second) */}
          <div className="field stack stack--tight" style={{ position: 'relative' }}>
            <TextField
              label={
                intakeSource === 'rescue_1122'
                  ? 'Dispatcher / Officer Name'
                  : intakeSource === 'field_patrol'
                    ? 'Rescuer / Team Member Name'
                    : intakeSource === 'partner_transfer'
                      ? 'Referring Partner / Shelter'
                      : 'Name'
              }
              hint="optional"
              placeholder={
                intakeSource === 'rescue_1122'
                  ? 'e.g. Tariq / Control Room'
                  : intakeSource === 'field_patrol'
                    ? 'e.g. Ameer Hamza / Tahira Zafar'
                    : intakeSource === 'partner_transfer'
                      ? "e.g. Todd's Welfare Society (TWS)"
                      : 'e.g. Usman Ali'
              }
              value={reporterName}
              onChange={(e) => {
                setReporterName(e.target.value)
                setShowCallerDropdown(true)
              }}
              onFocus={() => {
                if (callerSuggestions.length > 0) setShowCallerDropdown(true)
              }}
            />
          </div>

          {/* CNIC / Reference Field */}
          <div className="field stack stack--tight">
            <TextField
              label={
                intakeSource === 'rescue_1122'
                  ? 'Incident / Case Ref #'
                  : intakeSource === 'field_patrol'
                    ? 'Staff / Rescuer CNIC'
                    : intakeSource === 'partner_transfer'
                      ? 'Focal Person / Ref #'
                      : 'CNIC'
              }
              hint="optional"
              placeholder={
                intakeSource === 'rescue_1122'
                  ? 'e.g. LHR-8910'
                  : intakeSource === 'partner_transfer'
                    ? 'e.g. Case #412 / Dr. Asif'
                    : 'e.g. 42101-1234567-1'
              }
              value={reporterCnic}
              onChange={(e) => {
                const val = e.target.value
                setReporterCnic(
                  intakeSource === 'citizen' || intakeSource === 'field_patrol'
                    ? formatCnic(val)
                    : val,
                )
                if (error) setError(null)
              }}
            />
            {intakeSource === 'citizen' && reporterCnic.trim() ? (
              cnicValidation.isValid ? (
                <span
                  className="field__hint"
                  style={{
                    color: 'var(--color-forest)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 500,
                  }}
                >
                  <Check size={14} weight="bold" /> Valid 13-digit CNIC
                </span>
              ) : (
                <span
                  className="field__hint"
                  style={{ color: 'var(--color-amber)', fontWeight: 500 }}
                >
                  {cnicValidation.error}
                </span>
              )
            ) : null}
          </div>
        </div>

        {/* 3. Location & Landmark */}
        <div className="panel stack">
          <p className="section-label">Location Details</p>

          <AutocompleteField
            label="City"
            placeholder="e.g. Lahore, Karachi, Islamabad"
            value={city}
            onChange={(val) => {
              setCity(val)
              if (error) setError(null)
            }}
            suggestions={PAKISTAN_CITIES}
            required
          />

          <AutocompleteField
            label="Area / Neighborhood"
            placeholder={
              city.toLowerCase() === 'lahore'
                ? 'e.g. Gulberg III, DHA Phase 5, Model Town'
                : 'e.g. Area or neighborhood'
            }
            value={locationArea}
            onChange={(val) => {
              setLocationArea(val)
              if (error) setError(null)
            }}
            suggestions={getAreasForCity(city)}
            required
          />

          <TextField
            label="Landmark"
            hint="optional"
            placeholder="e.g. Opposite Fresco Sweets Main Corner"
            value={locationLandmark}
            onChange={(e) => setLocationLandmark(e.target.value)}
          />

          {/* Coordinates & Map Pin (Zero-cost GPS & Link Parser) */}
          <div className="field stack stack--tight">
            <label className="field__label" style={{ margin: 0 }}>
              GPS Coordinates <span className="field__hint">· optional</span>
            </label>

            {latitude != null && longitude != null ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={16} weight="bold" color="var(--color-brand, #de6b2b)" />
                  <span className="font-mono font-medium" style={{ fontSize: '0.875rem' }}>
                    {formatCoordinates(latitude, longitude)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <a
                    href={getNavigationUrl(latitude, longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-call-mini-btn"
                    title="Test navigation in Maps"
                    style={{ textDecoration: 'none' }}
                  >
                    <Compass size={13} weight="bold" aria-hidden />
                    <span>Preview</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setLatitude(null)
                      setLongitude(null)
                      setLocationLinkInput('')
                      setLocationError(null)
                    }}
                    className="pressable"
                    title="Clear coordinates"
                    aria-label="Clear coordinates"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      color: 'var(--color-ink-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={15} weight="bold" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="stack stack--tight">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={detectingLocation}
                  onClick={async () => {
                    setLocationError(null)
                    setDetectingLocation(true)
                    try {
                      const pos = await requestCurrentPosition()
                      setLatitude(pos.latitude)
                      setLongitude(pos.longitude)
                    } catch (err) {
                      setLocationError(err instanceof Error ? err.message : 'Unable to acquire location')
                    } finally {
                      setDetectingLocation(false)
                    }
                  }}
                  style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {detectingLocation ? (
                    <CircleNotch size={16} weight="bold" className="photo-capture__spin" />
                  ) : (
                    <Crosshair size={16} weight="bold" />
                  )}
                  <span>{detectingLocation ? 'Detecting GPS...' : 'Detect current location'}</span>
                </Button>

                <TextField
                  label="Location link or coordinates"
                  hint="optional"
                  placeholder="Paste Google Maps or WhatsApp location link"
                  value={locationLinkInput}
                  onChange={(e) => {
                    const val = e.target.value
                    setLocationLinkInput(val)
                    if (!val.trim()) {
                      setLocationError(null)
                      return
                    }
                    const parsed = parseCoordinates(val)
                    if (parsed) {
                      setLatitude(parsed.latitude)
                      setLongitude(parsed.longitude)
                      setLocationError(null)
                    } else if (val.includes('maps.app.goo.gl') || val.includes('goo.gl/maps')) {
                      setLocationError('Shortened links do not contain coordinates in the URL. Please open it in your browser and copy the coordinates or full URL.')
                    } else if (val.length > 15) {
                      setLocationError('Could not find latitude & longitude in text. You can also paste raw coordinates like 24.8607, 67.0011.')
                    }
                  }}
                />

                {locationError && (
                  <span className="field__hint" style={{ color: 'var(--color-danger, #b91c1c)', fontWeight: 500 }}>
                    {locationError}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. Photos & Proof (Optional) */}
        <div className="panel stack">
          <p className="section-label">Photos &amp; Proof</p>

          {/* Existing Photos in Edit Mode */}
          {isEditMode && existingPhotos.length > 0 && (
            <div className="stack stack--tight" style={{ marginBottom: '8px' }}>
              <span className="field__hint" style={{ fontWeight: 600 }}>
                Existing photos:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {existingPhotos
                  .filter((p) => !photosToDelete.includes(p.id))
                  .map((p) => (
                    <div
                      key={p.id}
                      style={{
                        position: 'relative',
                        width: '4.5rem',
                        height: '4.5rem',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {existingPhotoUrls[p.id] ? (
                        <img
                          src={existingPhotoUrls[p.id]}
                          alt="Report proof"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--color-surface)',
                          }}
                        >
                          <Camera size={20} color="var(--color-ink-muted)" />
                        </div>
                      )}
                      <button
                        type="button"
                        className="pressable"
                        onClick={() => setPhotosToDelete((prev) => [...prev, p.id])}
                        title="Remove photo"
                        aria-label="Remove photo"
                        style={{
                          position: 'absolute',
                          top: '3px',
                          right: '3px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={12} weight="bold" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <IntakePhotoPicker
            photos={stagedPhotos}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            disabled={submitting}
          />
        </div>

        {/* 5. Legal Action & Notice (Extra card in edit mode) */}
        {isEditMode && (category === 'cruelty' || existingReport?.legal_notes) && (
          <div className="panel stack">
            <p className="section-label">Legal Action &amp; Notice</p>
            <TextareaField
              label="Legal action details / Notice summary"
              placeholder="e.g. Warning notice issued under Animal Cruelty Act 1890, Police FIR #402/26 registered at Saddar PS. Owner instructed to cease heavy labor."
              value={legalNotes}
              onChange={(e) => setLegalNotes(e.target.value)}
              rows={4}
            />
          </div>
        )}

        {error ? <p className="form-error">{error}</p> : null}

        <div className="sticky-actions">
          <Button
            type="submit"
            variant="accent"
            block
            disabled={submitting || (!isEditMode && !member)}
          >
            {submitting
              ? isEditMode
                ? 'Saving changes…'
                : 'Logging report…'
              : isEditMode
                ? 'Save changes'
                : 'Log rescue report'}
          </Button>
        </div>
      </form>
    </section>
  )
}
