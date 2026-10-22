import { useEffect, useState } from 'react'
import { useDb } from '@/shared/hooks/useDb'
import { useCurrentMember } from '@/shared/hooks/useCurrentMember'
import {
  formatCurrency,
  sumExpensesByCategory,
  type ExpenseCategoryBreakdown,
} from '@/features/ledger/domain/ledger'
import { toSentenceCase } from '@/shared/lib/text'

export function ExpenseCategoriesCard() {
  const db = useDb()
  const { member } = useCurrentMember()
  const [categories, setCategories] = useState<ExpenseCategoryBreakdown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || !member) return
    let cancelled = false
    void (async () => {
      try {
        const res = await sumExpensesByCategory(db, member.orgId, 5)
        if (!cancelled) setCategories(res)
      } catch (err) {
        console.warn('Failed to load expense categories', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [db, member])

  const maxVal = Math.max(...categories.map((c) => c.totalCents), 1)

  return (
    <section className="overview-panel" aria-labelledby="overview-expense-categories-title">
      <div className="overview-panel__header row">
        <div className="overview-panel__heading">
          <h2 id="overview-expense-categories-title">Top expenses by category</h2>
          <p className="muted overview-panel__lede">
            Primary expenditures across veterinary care, food, and facilities.
          </p>
        </div>
      </div>

      {loading && categories.length === 0 ? (
        <p className="muted">Loading categories…</p>
      ) : categories.length === 0 ? (
        <p className="muted">No expense entries recorded yet.</p>
      ) : (
        <ul className="status-bars">
          {categories.map((cat) => (
            <li key={cat.categoryId} className="status-bars__row">
              <div className="status-bars__meta">
                <span>{toSentenceCase(cat.label)}</span>
                <strong>{formatCurrency(cat.totalCents, member?.currency)}</strong>
              </div>
              <div className="status-bars__track" aria-hidden>
                <div
                  className="status-bars__fill"
                  style={{
                    width: `${(cat.totalCents / maxVal) * 100}%`,
                    background: 'var(--color-brand)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
