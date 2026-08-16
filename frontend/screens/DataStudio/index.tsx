import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import {
  Database,
  Search,
  Trash2,
  Edit2,
  RefreshCw,
  Table as TableIcon,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ExternalLink,
  Code,
  FileSpreadsheet,
  X,
  Save,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CollectionItem {
  name: string
  label: string
  totalRecords: number
  lastUpdated: string | null
  isSystem: boolean
}

interface ColumnSchema {
  key: string
  label: string
  type: string
}

export function DataStudio() {
  const [collections, setCollections] = useState<CollectionItem[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>('leads')
  const [, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([])
  const [columns, setColumns] = useState<ColumnSchema[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('updated_at')
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC')

  // Selected row inspection & edit state
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null)
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null)
  const [editingCell, setEditingCell] = useState<{ id: string; key: string; val: string } | null>(null)

  const loadCollections = async () => {
    try {
      setLoading(true)
      const res = await api.collections.list()
      setCollections(res.collections || [])
      if (res.collections?.length > 0 && !res.collections.some(c => c.name === selectedCollection)) {
        setSelectedCollection(res.collections[0].name)
      }
    } catch (err: any) {
      toast.error(`Failed to load collections: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  const loadRecords = useCallback(async () => {
    if (!selectedCollection) return
    try {
      setRecordsLoading(true)
      const res = await api.collections.get(selectedCollection, {
        page,
        limit,
        search,
        sortBy,
        sortDir,
      })
      setRecords(res.records || [])
      setColumns(res.columns || [])
      setTotalRecords(res.total || 0)
      setTotalPages(res.totalPages || 1)
    } catch (err: any) {
      toast.error(`Failed to load records: ${err?.message || err}`)
    } finally {
      setRecordsLoading(false)
    }
  }, [selectedCollection, page, limit, search, sortBy, sortDir])

  useEffect(() => {
    loadCollections()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [selectedCollection, search])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const handleSort = (colKey: string) => {
    if (sortBy === colKey) {
      setSortDir(prev => (prev === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortBy(colKey)
      setSortDir('DESC')
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      toast.loading(`Preparing ${format.toUpperCase()} export...`, { id: 'export' })
      const res = await api.collections.export(selectedCollection, format)
      
      const content = typeof res === 'string' ? res : JSON.stringify(res, null, 2)
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedCollection}-export-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Exported ${selectedCollection} successfully!`, { id: 'export' })
    } catch (err: any) {
      toast.error(`Export failed: ${err?.message || err}`, { id: 'export' })
    }
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      await api.collections.delete(selectedCollection, id)
      toast.success('Record deleted')
      setRecords(prev => prev.filter(r => String(r.id) !== String(id)))
      setTotalRecords(prev => Math.max(0, prev - 1))
      if (selectedRow && String(selectedRow.id) === String(id)) setSelectedRow(null)
    } catch (err: any) {
      toast.error(`Delete failed: ${err?.message || err}`)
    }
  }

  const handleSaveRow = async () => {
    if (!editingRow || !editingRow.id) return
    try {
      const id = String(editingRow.id)
      await api.collections.update(selectedCollection, id, editingRow)
      toast.success('Record updated')
      setRecords(prev => prev.map(r => String(r.id) === id ? { ...r, ...editingRow } : r))
      setSelectedRow({ ...editingRow })
      setEditingRow(null)
    } catch (err: any) {
      toast.error(`Update failed: ${err?.message || err}`)
    }
  }

  const handleSaveCell = async (id: string, key: string, value: string) => {
    try {
      await api.collections.update(selectedCollection, id, { [key]: value })
      setRecords(prev => prev.map(r => String(r.id) === id ? { ...r, [key]: value } : r))
      setEditingCell(null)
      toast.success('Cell saved')
    } catch (err: any) {
      toast.error(`Failed to save cell: ${err?.message || err}`)
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Data Studio & Collections Explorer
            </h1>
            <p className="text-xs text-slate-400">
              Universal spreadsheet grid & schema inspector for all scraped collections and datasets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { loadCollections(); loadRecords() }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recordsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded p-0.5">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Export as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Export as JSON"
            >
              <Code className="w-3.5 h-3.5 text-blue-400" />
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout: Collections List (Sidebar) + Tabular Data Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collections Sidebar */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col gap-2 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">
            Collections ({collections.length})
          </div>

          <div className="space-y-1">
            {collections.map(col => {
              const isSelected = col.name === selectedCollection
              return (
                <button
                  key={col.name}
                  onClick={() => setSelectedCollection(col.name)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-sm'
                      : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="truncate">{col.label}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {col.totalRecords}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Grid & Toolbar Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Table Toolbar */}
          <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder={`Search in ${selectedCollection}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Showing {records.length} of {totalRecords} records</span>
              <span className="text-slate-600">•</span>
              <span>Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1 ml-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1 rounded bg-slate-800 border border-slate-700 disabled:opacity-30 hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1 rounded bg-slate-800 border border-slate-700 disabled:opacity-30 hover:bg-slate-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto bg-slate-950">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 text-slate-500">
                <TableIcon className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-sm font-medium text-slate-400">No records found in '{selectedCollection}'</p>
                <p className="text-xs text-slate-600 mt-1">Run a pipeline targeting this collection to populate records.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 backdrop-blur">
                    <th className="py-2.5 px-3 font-semibold text-slate-400 w-12 text-center">#</th>
                    {columns.slice(0, 12).map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="py-2.5 px-3 font-semibold text-slate-300 hover:text-white cursor-pointer select-none transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{col.label}</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        </div>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 font-semibold text-slate-400 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {records.map((rec, idx) => {
                    const rowNumber = (page - 1) * limit + idx + 1
                    const isSelected = selectedRow && String(selectedRow.id) === String(rec.id)
                    return (
                      <tr
                        key={String(rec.id) || idx}
                        onClick={() => setSelectedRow(rec)}
                        className={`hover:bg-slate-900/60 cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-500/10' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-500 text-center select-none font-sans text-[11px]">
                          {rowNumber}
                        </td>
                        {columns.slice(0, 12).map(col => {
                          const val = rec[col.key]
                          const strVal = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
                          const isEditing = editingCell?.id === String(rec.id) && editingCell?.key === col.key

                          return (
                            <td
                              key={col.key}
                              className="py-2.5 px-3 max-w-[220px] truncate text-slate-300"
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                setEditingCell({ id: String(rec.id), key: col.key, val: strVal })
                              }}
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  autoFocus
                                  defaultValue={editingCell.val}
                                  onBlur={(e) => handleSaveCell(String(rec.id), col.key, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCell(String(rec.id), col.key, (e.target as any).value)
                                    if (e.key === 'Escape') setEditingCell(null)
                                  }}
                                  className="w-full bg-slate-800 border border-emerald-500 px-1 py-0.5 rounded text-white text-xs"
                                />
                              ) : col.type === 'url' && strVal ? (
                                <a
                                  href={strVal.startsWith('http') ? strVal : `https://${strVal}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  <span className="truncate">{strVal}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ) : col.type === 'badge' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-300">
                                  {strVal}
                                </span>
                              ) : (
                                <span>{strVal || <span className="text-slate-600 italic">null</span>}</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingRow(rec); setSelectedRow(rec) }}
                              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                              title="Edit Record"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(String(rec.id), e)}
                              className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Row Detail / Editor Drawer */}
        {selectedRow && (
          <div className="w-96 border-l border-slate-800 bg-slate-900/90 p-5 flex flex-col overflow-hidden backdrop-blur">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Record Payload</h3>
              </div>
              <div className="flex items-center gap-2">
                {editingRow ? (
                  <button
                    onClick={handleSaveRow}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingRow({ ...selectedRow })}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => { setSelectedRow(null); setEditingRow(null) }}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 font-mono text-xs">
              {Object.entries(editingRow || selectedRow).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <span className="text-slate-400 text-[11px] font-semibold">{key}</span>
                  {editingRow && key !== 'id' ? (
                    <input
                      type="text"
                      value={typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                      onChange={(e) => setEditingRow({ ...editingRow, [key]: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <div className="bg-slate-950 p-2 rounded border border-slate-800/80 text-slate-200 break-all select-all">
                      {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? 'null')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
              <span>ID: {String(selectedRow.id)}</span>
              <button
                onClick={() => handleDelete(String(selectedRow.id))}
                className="text-red-400 hover:text-red-300 font-medium"
              >
                Delete Record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export default DataStudio
