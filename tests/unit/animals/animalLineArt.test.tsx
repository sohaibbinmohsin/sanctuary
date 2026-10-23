import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AnimalLineArt } from '@/features/animals/components/AnimalLineArt'

describe('AnimalLineArt', () => {
  it('renders SVG for adult Dog', () => {
    const { container } = render(<AnimalLineArt species="Dog" lifeStage="adult" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('data-species')).toBe('dog')
    expect(svg?.getAttribute('data-stage')).toBe('adult')
  })

  it('renders distinct SVG for puppy (Dog child)', () => {
    const { container } = render(<AnimalLineArt species="Dog" lifeStage="child" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('data-species')).toBe('dog')
    expect(svg?.getAttribute('data-stage')).toBe('child')
  })

  it('renders all species variants without error', () => {
    const speciesList = ['Dog', 'Cat', 'Horse', 'Donkey', 'Bird', 'Other']
    for (const species of speciesList) {
      for (const lifeStage of ['adult', 'child'] as const) {
        const { container } = render(<AnimalLineArt species={species} lifeStage={lifeStage} />)
        const svg = container.querySelector('svg')
        expect(svg).toBeTruthy()
      }
    }
  })

  it('falls back to Other adult when species is unknown or null', () => {
    const { container } = render(<AnimalLineArt species={null} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('data-species')).toBe('other')
    expect(svg?.getAttribute('data-stage')).toBe('adult')
  })

  it('applies aspectRatio, className, role, and ariaLabel props', () => {
    const { container } = render(
      <AnimalLineArt
        species="Cat"
        lifeStage="child"
        aspectRatio="video"
        className="custom-art"
        role="img"
        ariaLabel="Kitten illustration"
      />
    )
    const wrapper = container.querySelector('.animal-line-art')
    expect(wrapper).toBeTruthy()
    expect(wrapper?.classList.contains('animal-line-art--video')).toBe(true)
    expect(wrapper?.classList.contains('custom-art')).toBe(true)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('Kitten illustration')
  })
})
