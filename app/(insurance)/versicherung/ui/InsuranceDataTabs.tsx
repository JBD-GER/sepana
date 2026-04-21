"use client"

import { useState } from "react"

type TabItem = {
  label: string
  value: string
}

type TabSection = {
  id: string
  label: string
  description?: string
  items: TabItem[]
}

export default function InsuranceDataTabs({ sections }: { sections: TabSection[] }) {
  const availableSections = sections.filter((section) => section.items.length > 0)
  const [activeId, setActiveId] = useState(availableSections[0]?.id ?? "")
  const activeSection = availableSections.find((section) => section.id === activeId) ?? availableSections[0] ?? null

  if (!activeSection) return null

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Antragsdaten</div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Kreditdaten sauber gegliedert</h2>
          <p className="mt-1 text-sm text-slate-600">
            Die kompletten Angaben aus Kredit ohne Schufa sind hier in Bereiche aufgeteilt.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableSections.map((section) => {
            const active = section.id === activeSection.id
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {section.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{activeSection.label}</div>
        {activeSection.description ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{activeSection.description}</p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {activeSection.items.map((item) => (
            <div key={`${activeSection.id}-${item.label}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</div>
              <div className="mt-2 text-sm font-medium text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
