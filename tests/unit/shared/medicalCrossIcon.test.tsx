import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MedicalCrossIcon } from '@/shared/ui/MedicalCrossIcon'

describe('MedicalCrossIcon', () => {
  it('renders SVG with medical equilateral cross path', () => {
    const { container } = render(<MedicalCrossIcon size={24} className="test-cross" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('height', '24')
    expect(svg).toHaveClass('test-cross')
    const path = svg?.querySelector('path')
    expect(path).toBeInTheDocument()
  })
})
