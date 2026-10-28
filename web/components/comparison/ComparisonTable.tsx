'use client'

import React, { useState } from 'react'
import { Check, X, HelpCircle, Sparkles } from 'lucide-react'

export interface FeatureItem {
  name: string
  description: string
  apexLead: string | boolean
  competitor: string | boolean
  advantage: 'apex' | 'competitor' | 'neutral'
}

export interface FeatureCategory {
  category: string
  features: FeatureItem[]
}

interface ComparisonTableProps {
  competitorName: string
  categories: FeatureCategory[]
}

export function ComparisonTable({ competitorName, categories }: ComparisonTableProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const filteredCategories =
    activeCategory === 'all'
      ? categories
      : categories.filter((c) => c.category === activeCategory)

  return (
    <div className="w-full space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 pb-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeCategory === 'all'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
          }`}
        >
          All Features
        </button>
        {categories.map((c) => (
          <button
            key={c.category}
            onClick={() => setActiveCategory(c.category)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeCategory === c.category
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {c.category}
          </button>
        ))}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04]">
              <th className="p-5 text-sm font-semibold text-neutral-300 w-1/2">Capability</th>
              <th className="p-5 text-sm font-bold text-indigo-400 bg-indigo-600/10 border-x border-indigo-500/30 w-1/4">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-white text-base">ApexLead</span>
                </div>
              </th>
              <th className="p-5 text-sm font-semibold text-neutral-400 w-1/4">
                {competitorName}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {filteredCategories.map((cat) => (
              <React.Fragment key={cat.category}>
                <tr className="bg-white/[0.03]">
                  <td
                    colSpan={3}
                    className="py-3 px-5 text-xs font-extrabold uppercase tracking-wider text-indigo-400"
                  >
                    {cat.category}
                  </td>
                </tr>
                {cat.features.map((feat, fi) => (
                  <tr key={fi} className="hover:bg-white/[0.02] transition">
                    <td className="p-5">
                      <div className="font-semibold text-white">{feat.name}</div>
                      <div className="text-xs text-neutral-400 mt-1 leading-relaxed">{feat.description}</div>
                    </td>
                    <td className="p-5 bg-indigo-600/5 border-x border-indigo-500/20 font-semibold text-white">
                      {renderVal(feat.apexLead, true)}
                    </td>
                    <td className="p-5 text-neutral-400">
                      {renderVal(feat.competitor, false)}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function renderVal(val: string | boolean, isApex: boolean) {
  if (typeof val === 'boolean') {
    return val ? (
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <Check className="w-4 h-4 stroke-[3]" /> Supported
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-neutral-500">
        <X className="w-4 h-4" /> Not Supported
      </span>
    )
  }
  return <span>{val}</span>
}
