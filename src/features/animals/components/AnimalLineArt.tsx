import type { JSX } from 'react'
import './AnimalLineArt.css'

export type AnimalLineArtProps = {
  species?: string | null
  lifeStage?: 'adult' | 'child' | null
  className?: string
  aspectRatio?: 'square' | 'video' | 'cover'
  role?: string
  ariaLabel?: string
}

type CanonicalSpecies = 'dog' | 'cat' | 'horse' | 'donkey' | 'bird' | 'other'
type CanonicalStage = 'adult' | 'child'

function normalizeSpecies(raw?: string | null): CanonicalSpecies {
  if (!raw) return 'other'
  const lower = raw.trim().toLowerCase()
  if (lower === 'dog') return 'dog'
  if (lower === 'cat') return 'cat'
  if (lower === 'horse') return 'horse'
  if (lower === 'donkey') return 'donkey'
  if (lower === 'bird') return 'bird'
  return 'other'
}

function normalizeStage(raw?: string | null): CanonicalStage {
  if (raw === 'child') return 'child'
  return 'adult'
}

/* 12 Handcrafted SVG Illustrations (Dog, Cat, Horse, Donkey, Bird, Other x adult, child) */
function renderIllustration(species: CanonicalSpecies, stage: CanonicalStage): JSX.Element {
  switch (species) {
    case 'dog':
      if (stage === 'child') {
        // Puppy: round head, floppy ears, curious snout, soft body outline, wagging tail
        return (
          <g className="animal-line-art__dog-puppy">
            {/* Ground accent arc */}
            <path className="animal-line-art__subtle" d="M24 82 C38 85, 62 85, 76 82" />
            {/* Body and paws */}
            <path
              className="animal-line-art__path"
              d="M38 68 C36 74, 34 78, 32 80 C36 81, 42 81, 44 80 C44 75, 45 70, 46 66"
            />
            <path
              className="animal-line-art__path"
              d="M54 66 C55 70, 56 75, 56 80 C58 81, 64 81, 68 80 C66 78, 64 74, 62 68"
            />
            <path
              className="animal-line-art__path"
              d="M32 72 C27 68, 26 56, 34 50 C37 47, 43 45, 50 45 C57 45, 63 47, 66 50 C74 56, 73 68, 68 72"
            />
            {/* Playful tail */}
            <path
              className="animal-line-art__path"
              d="M68 62 C74 60, 80 54, 80 46 C77 46, 75 49, 72 53"
            />
            {/* Puppy head: rounder cheeks */}
            <path
              className="animal-line-art__path"
              d="M35 34 C33 26, 38 20, 50 20 C62 20, 67 26, 65 34 C64 42, 59 47, 50 47 C41 47, 36 42, 35 34 Z"
            />
            {/* Left floppy ear */}
            <path
              className="animal-line-art__path"
              d="M36 24 C31 22, 23 27, 25 38 C26 43, 31 43, 34 37"
            />
            {/* Right floppy ear */}
            <path
              className="animal-line-art__path"
              d="M64 24 C69 22, 77 27, 75 38 C74 43, 69 43, 66 37"
            />
            {/* Cute button nose */}
            <path className="animal-line-art__fill" d="M47 37 C47 35, 53 35, 53 37 C53 39, 47 39, 47 37 Z" />
            <path className="animal-line-art__path" d="M50 38 L50 41 M47 41 C48 42, 52 42, 53 41" />
            {/* Eyes */}
            <circle cx="43" cy="30" r="1.75" className="animal-line-art__fill" />
            <circle cx="57" cy="30" r="1.75" className="animal-line-art__fill" />
            {/* Forehead spark/accent */}
            <path className="animal-line-art__accent" d="M48 24 L50 21 L52 24" />
          </g>
        )
      }
      // Adult dog: dignified, sturdy snout, alert ears, chest outline
      return (
        <g className="animal-line-art__dog-adult">
          <path className="animal-line-art__subtle" d="M20 84 C38 86, 62 86, 80 84" />
          {/* Back, chest, seated silhouette */}
          <path
            className="animal-line-art__path"
            d="M32 82 C34 70, 36 58, 43 50 C48 44, 49 39, 47 33"
          />
          <path
            className="animal-line-art__path"
            d="M47 33 C45 27, 48 20, 56 18 C64 16, 70 20, 71 27 C72 32, 70 36, 67 40 C73 50, 75 64, 73 82"
          />
          {/* Snout and jaw */}
          <path
            className="animal-line-art__path"
            d="M67 30 C74 31, 80 33, 80 37 C80 40, 76 42, 70 42 C67 42, 65 41, 64 40"
          />
          {/* Nose */}
          <path className="animal-line-art__fill" d="M78 34 C80 34, 80 37, 78 37 C77 37, 77 34, 78 34 Z" />
          {/* Eye */}
          <circle cx="62" cy="27" r="1.8" className="animal-line-art__fill" />
          {/* Folded / alert ear */}
          <path
            className="animal-line-art__path"
            d="M52 20 C52 14, 57 12, 60 17 C62 21, 57 26, 52 26 Z"
          />
          {/* Collar / neck detail */}
          <path className="animal-line-art__accent" d="M48 46 C54 48, 62 48, 67 45" />
          {/* Front leg & paw */}
          <path
            className="animal-line-art__path"
            d="M56 54 L56 82 C56 83, 62 83, 63 82 L63 56"
          />
        </g>
      )

    case 'cat':
      if (stage === 'child') {
        // Kitten: big pointed upright ears, compact face, whisker accents, curled tail
        return (
          <g className="animal-line-art__cat-kitten">
            <path className="animal-line-art__subtle" d="M25 82 C38 85, 62 85, 75 82" />
            {/* Compact body & front paws */}
            <path
              className="animal-line-art__path"
              d="M36 78 C36 68, 38 58, 44 54 C47 52, 53 52, 56 54 C62 58, 64 68, 64 78"
            />
            <path className="animal-line-art__path" d="M42 74 L42 81 M50 74 L50 81 M58 74 L58 81" />
            {/* Curled kitten tail */}
            <path
              className="animal-line-art__path"
              d="M64 74 C73 75, 78 70, 77 62 C76 56, 71 56, 70 60"
            />
            {/* Round kitten head */}
            <circle cx="50" cy="38" r="14" className="animal-line-art__path" />
            {/* Left large ear */}
            <path
              className="animal-line-art__path"
              d="M38 31 L32 16 C37 17, 43 23, 44 26"
            />
            {/* Right large ear */}
            <path
              className="animal-line-art__path"
              d="M62 31 L68 16 C63 17, 57 23, 56 26"
            />
            {/* Eyes */}
            <circle cx="44" cy="37" r="1.8" className="animal-line-art__fill" />
            <circle cx="56" cy="37" r="1.8" className="animal-line-art__fill" />
            {/* Tiny nose & mouth */}
            <path className="animal-line-art__fill" d="M49 42 L51 42 L50 43.5 Z" />
            <path className="animal-line-art__path" d="M50 43.5 L50 45 M48 46 C49 47, 51 47, 52 46" />
            {/* Whiskers */}
            <path className="animal-line-art__subtle" d="M37 41 L43 42 M36 45 L43 44" />
            <path className="animal-line-art__subtle" d="M63 41 L57 42 M64 45 L57 44" />
            {/* Playful ear inner stroke */}
            <path className="animal-line-art__accent" d="M36 26 L38 21 L41 26" />
            <path className="animal-line-art__accent" d="M64 26 L62 21 L59 26" />
          </g>
        )
      }
      // Adult cat: sleek profile, arched back, curved tall tail, elegant posture
      return (
        <g className="animal-line-art__cat-adult">
          <path className="animal-line-art__subtle" d="M22 84 C38 86, 62 86, 78 84" />
          {/* Seated cat spine and chest curve */}
          <path
            className="animal-line-art__path"
            d="M38 82 C36 68, 38 52, 45 44 C48 40, 48 34, 46 30"
          />
          <path
            className="animal-line-art__path"
            d="M58 82 C58 66, 60 52, 56 42"
          />
          {/* Head & elegant muzzle */}
          <path
            className="animal-line-art__path"
            d="M46 30 C46 22, 53 19, 58 20 C64 22, 68 28, 68 34 C67 39, 62 42, 56 42"
          />
          {/* Ears */}
          <path
            className="animal-line-art__path"
            d="M48 22 L45 12 C50 14, 53 18, 54 20"
          />
          <path
            className="animal-line-art__path"
            d="M58 20 C60 17, 63 13, 67 15 L64 24"
          />
          {/* Eye */}
          <ellipse cx="61" cy="28" rx="1.5" ry="2" className="animal-line-art__fill" />
          {/* Whiskers */}
          <path className="animal-line-art__subtle" d="M66 34 L76 33 M65 37 L75 38" />
          {/* Flowing arched tail */}
          <path
            className="animal-line-art__path"
            d="M38 78 C30 76, 24 64, 25 50 C26 44, 30 42, 32 46 C32 54, 30 68, 36 74"
          />
          {/* Front paws */}
          <path className="animal-line-art__path" d="M52 58 L52 82 C52 83, 58 83, 58 82" />
        </g>
      )

    case 'horse':
      if (stage === 'child') {
        // Foal: slender long legs, tufted short mane, delicate inquisitive head
        return (
          <g className="animal-line-art__horse-foal">
            <path className="animal-line-art__subtle" d="M18 86 C38 88, 62 88, 82 86" />
            {/* Long slender legs */}
            <path className="animal-line-art__path" d="M34 58 L32 85 M40 58 L38 85" />
            <path className="animal-line-art__path" d="M62 58 L64 85 M68 58 L70 85" />
            {/* Compact young body & rump */}
            <path
              className="animal-line-art__path"
              d="M32 58 C32 50, 42 48, 52 48 C62 48, 68 50, 68 58"
            />
            {/* Fluffy foal tail */}
            <path className="animal-line-art__path" d="M30 54 C26 58, 25 66, 28 70" />
            {/* Slender neck arching up */}
            <path
              className="animal-line-art__path"
              d="M60 48 L68 28 C68 24, 72 20, 77 22 C81 24, 82 28, 78 32 L70 42"
            />
            {/* Delicate head and muzzle */}
            <path
              className="animal-line-art__path"
              d="M75 22 L84 26 C85 28, 83 31, 80 32 L75 32"
            />
            <circle cx="76" cy="25" r="1.4" className="animal-line-art__fill" />
            {/* Alert ears */}
            <path className="animal-line-art__path" d="M70 24 L70 16 L74 22" />
            {/* Short spiky foal mane */}
            <path
              className="animal-line-art__accent"
              d="M68 28 L65 26 M66 32 L63 30 M64 37 L61 35 M62 42 L59 40"
            />
          </g>
        )
      }
      // Adult horse: sculpted equine bust / profile, majestic flowing mane, powerful crest
      return (
        <g className="animal-line-art__horse-adult">
          <path className="animal-line-art__subtle" d="M18 84 C40 87, 60 87, 82 84" />
          {/* Muscular neck & back line */}
          <path
            className="animal-line-art__path"
            d="M24 82 C28 66, 36 50, 48 38 C54 32, 57 24, 58 16"
          />
          {/* Forehead and nose bridge */}
          <path
            className="animal-line-art__path"
            d="M64 16 L76 34 C78 37, 78 42, 75 44 C71 46, 68 44, 65 40 L58 36"
          />
          {/* Throat and chest curve */}
          <path
            className="animal-line-art__path"
            d="M58 36 C55 48, 62 64, 74 82"
          />
          {/* Nostril & gentle mouth */}
          <circle cx="73" cy="42" r="1.3" className="animal-line-art__fill" />
          {/* Expressive eye */}
          <ellipse cx="64" cy="27" rx="1.6" ry="2.2" className="animal-line-art__fill" />
          <path className="animal-line-art__subtle" d="M61 24 C64 23, 67 24, 69 26" />
          {/* Regal horse ears */}
          <path
            className="animal-line-art__path"
            d="M57 18 L58 10 C61 11, 63 14, 63 18"
          />
          <path
            className="animal-line-art__path"
            d="M62 18 L65 11 C67 13, 67 16, 65 19"
          />
          {/* Flowing mane waves */}
          <path
            className="animal-line-art__accent"
            d="M57 16 C50 20, 48 26, 44 28 C48 30, 46 36, 40 40 C44 42, 42 48, 35 52 C40 55, 38 62, 30 68"
          />
        </g>
      )

    case 'donkey':
      if (stage === 'child') {
        // Baby donkey / foal: oversized prominent ears, fuzzy muzzle, gentle curved back
        return (
          <g className="animal-line-art__donkey-child">
            <path className="animal-line-art__subtle" d="M20 84 C38 86, 62 86, 80 84" />
            {/* Body and legs */}
            <path className="animal-line-art__path" d="M34 60 L33 83 M42 60 L41 83" />
            <path className="animal-line-art__path" d="M58 60 L60 83 M66 60 L67 83" />
            <path
              className="animal-line-art__path"
              d="M32 60 C32 52, 40 50, 50 50 C60 50, 66 52, 66 60"
            />
            {/* Cute donkey tail with tuft */}
            <path className="animal-line-art__path" d="M30 56 C26 62, 27 72, 26 76" />
            <circle cx="26" cy="77" r="1.6" className="animal-line-art__accent" />
            {/* Neck & round head */}
            <path
              className="animal-line-art__path"
              d="M56 50 L64 36 C64 32, 68 28, 73 29 C78 30, 80 34, 76 38 L68 46"
            />
            {/* Muzzle */}
            <path className="animal-line-art__path" d="M72 30 L80 34 C81 37, 78 40, 75 40 L70 38" />
            <circle cx="72" cy="32" r="1.5" className="animal-line-art__fill" />
            {/* Distinctive OVERSIZED donkey ears */}
            <path
              className="animal-line-art__path"
              d="M62 34 L56 12 C60 12, 65 18, 66 28"
            />
            <path
              className="animal-line-art__path"
              d="M66 31 L66 10 C70 10, 73 17, 72 26"
            />
            {/* Ear inner accents */}
            <path className="animal-line-art__accent" d="M59 17 L62 25 M68 15 L69 23" />
          </g>
        )
      }
      // Adult donkey: iconic tall upright ears, strong jaw, sturdy head, tufted mane
      return (
        <g className="animal-line-art__donkey-adult">
          <path className="animal-line-art__subtle" d="M20 84 C40 87, 60 87, 80 84" />
          {/* Sturdy neck and chest */}
          <path
            className="animal-line-art__path"
            d="M28 82 C32 66, 38 52, 48 42 C52 38, 54 32, 54 26"
          />
          <path
            className="animal-line-art__path"
            d="M54 26 L62 32 L74 44 C76 47, 74 52, 70 54 L62 52 C58 60, 64 72, 72 82"
          />
          {/* Snout with white muzzle demarcation line */}
          <path className="animal-line-art__subtle" d="M68 40 L62 46" />
          <circle cx="71" cy="49" r="1.4" className="animal-line-art__fill" />
          {/* Kind eye */}
          <circle cx="58" cy="34" r="1.8" className="animal-line-art__fill" />
          {/* Long prominent upright ears */}
          <path
            className="animal-line-art__path"
            d="M50 26 L45 8 C50 7, 56 13, 56 22"
          />
          <path
            className="animal-line-art__path"
            d="M55 24 L56 6 C62 6, 65 14, 62 24"
          />
          {/* Ear inner lines */}
          <path className="animal-line-art__accent" d="M49 14 L52 21 M58 12 L59 19" />
          {/* Stiff upright bristly donkey mane */}
          <path
            className="animal-line-art__accent"
            d="M49 30 L45 28 M46 36 L42 34 M43 42 L39 40 M39 48 L35 46 M35 55 L31 53"
          />
        </g>
      )

    case 'bird':
      if (stage === 'child') {
        // Chick: round fluffy body, tiny wings, small beak, big eye, tiny feet
        return (
          <g className="animal-line-art__bird-chick">
            <path className="animal-line-art__subtle" d="M26 82 C38 85, 62 85, 74 82" />
            {/* Tiny feet */}
            <path className="animal-line-art__path" d="M44 75 L42 81 M44 81 L46 81 M56 75 L54 81 M56 81 L58 81" />
            {/* Round fluffy chick body */}
            <path
              className="animal-line-art__path"
              d="M34 58 C30 68, 38 76, 50 76 C62 76, 70 68, 66 58 C68 50, 64 40, 56 36 C52 34, 46 34, 42 37 C34 42, 32 50, 34 58 Z"
            />
            {/* Fluffy head top tuft */}
            <path className="animal-line-art__accent" d="M46 34 C48 30, 50 30, 50 33 C52 30, 54 30, 53 34" />
            {/* Little wing */}
            <path
              className="animal-line-art__path"
              d="M42 54 C46 54, 52 56, 52 64 C48 66, 42 64, 40 58 Z"
            />
            {/* Large curious eye */}
            <circle cx="56" cy="44" r="2.2" className="animal-line-art__fill" />
            <circle cx="57" cy="43.2" r="0.7" fill="#ffffff" />
            {/* Tiny triangular beak */}
            <path className="animal-line-art__fill" d="M64 45 L72 47 L64 50 Z" />
          </g>
        )
      }
      // Adult bird: perched silhouette, sleek wing curves, tail feathers, slender beak
      return (
        <g className="animal-line-art__bird-adult">
          {/* Perched branch */}
          <path className="animal-line-art__subtle" d="M20 74 C36 72, 60 74, 82 70" />
          {/* Claws gripping */}
          <path className="animal-line-art__path" d="M47 70 L47 74 M51 70 L51 74 M55 70 L55 74" />
          {/* Long tail feathers extending downward */}
          <path
            className="animal-line-art__path"
            d="M36 64 L26 84 C28 85, 34 83, 38 78 L42 66"
          />
          {/* Sleek perched body */}
          <path
            className="animal-line-art__path"
            d="M38 48 C36 34, 44 22, 54 22 C62 22, 68 28, 66 36 C64 42, 62 48, 62 58 C62 68, 54 72, 46 72 C40 72, 36 68, 38 60"
          />
          {/* Folded wing line with accents */}
          <path
            className="animal-line-art__path"
            d="M48 38 C54 44, 56 52, 52 64 C48 62, 44 54, 44 44"
          />
          <path className="animal-line-art__accent" d="M46 48 C49 52, 50 58, 48 64" />
          {/* Eye */}
          <circle cx="59" cy="30" r="1.6" className="animal-line-art__fill" />
          {/* Sleek beak */}
          <path className="animal-line-art__path" d="M66 31 L77 34 L65 37" />
          {/* Crest / feather accent on head */}
          <path className="animal-line-art__accent" d="M52 22 C53 16, 57 15, 59 18" />
        </g>
      )

    case 'other':
    default:
      if (stage === 'child') {
        // Juvenile sanctuary creature: baby animal emblem with protective leaf & small paw
        return (
          <g className="animal-line-art__other-child">
            <circle cx="50" cy="50" r="32" className="animal-line-art__subtle" />
            {/* Small sanctuary paw emblem */}
            <circle cx="50" cy="56" r="8" className="animal-line-art__path" />
            <circle cx="41" cy="44" r="3.2" className="animal-line-art__fill" />
            <circle cx="47" cy="40" r="3.2" className="animal-line-art__fill" />
            <circle cx="53" cy="40" r="3.2" className="animal-line-art__fill" />
            <circle cx="59" cy="44" r="3.2" className="animal-line-art__fill" />
            {/* Sprouting leaf / seedling overhead representing young life */}
            <path
              className="animal-line-art__accent"
              d="M50 32 C50 24, 44 20, 42 22 C42 26, 46 30, 50 32 Z"
            />
            <path
              className="animal-line-art__accent"
              d="M50 32 C52 24, 58 22, 58 25 C56 29, 52 31, 50 32 Z"
            />
            <path className="animal-line-art__path" d="M50 32 L50 38" />
          </g>
        )
      }
      // Adult sanctuary creature / emblem: protective sanctuary wreath & prominent paw
      return (
        <g className="animal-line-art__other-adult">
          <circle cx="50" cy="50" r="34" className="animal-line-art__subtle" />
          {/* Central iconic sanctuary paw */}
          <path
            className="animal-line-art__path"
            d="M40 56 C37 50, 42 45, 50 45 C58 45, 63 50, 60 56 C58 63, 42 63, 40 56 Z"
          />
          <circle cx="38" cy="42" r="4.2" className="animal-line-art__fill" />
          <circle cx="46" cy="36" r="4.2" className="animal-line-art__fill" />
          <circle cx="54" cy="36" r="4.2" className="animal-line-art__fill" />
          <circle cx="62" cy="42" r="4.2" className="animal-line-art__fill" />
          {/* Laurel / sanctuary leaves surrounding */}
          <path
            className="animal-line-art__accent"
            d="M26 62 C24 50, 27 38, 34 30 C32 36, 33 46, 35 52"
          />
          <path
            className="animal-line-art__accent"
            d="M74 62 C76 50, 73 38, 66 30 C68 36, 67 46, 65 52"
          />
          <path
            className="animal-line-art__accent"
            d="M44 72 C48 74, 52 74, 56 72"
          />
        </g>
      )
  }
}

export function AnimalLineArt({
  species,
  lifeStage,
  className = '',
  aspectRatio = 'square',
  role,
  ariaLabel,
}: AnimalLineArtProps): JSX.Element {
  const normSpecies = normalizeSpecies(species)
  const normStage = normalizeStage(lifeStage)

  const aspectClass =
    aspectRatio === 'video'
      ? 'animal-line-art--video'
      : aspectRatio === 'cover'
        ? 'animal-line-art--cover'
        : 'animal-line-art--square'

  const containerClasses = ['animal-line-art', aspectClass, className].filter(Boolean).join(' ')

  const defaultLabel = `${normSpecies} ${normStage} illustration`

  return (
    <div className={containerClasses}>
      <svg
        className="animal-line-art__svg"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        data-species={normSpecies}
        data-stage={normStage}
        role={role}
        aria-label={role === 'img' ? ariaLabel || defaultLabel : undefined}
      >
        <rect width="100" height="100" className="animal-line-art__bg" rx="10" />
        {renderIllustration(normSpecies, normStage)}
      </svg>
    </div>
  )
}
