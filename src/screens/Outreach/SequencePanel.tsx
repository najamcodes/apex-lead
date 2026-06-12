// src/screens/Outreach/SequencePanel.tsx
import { useEffect } from 'react'
import { CheckCircle, Clock, XCircle, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { useOutreachStore } from '../../store/outreach.store'
import type { OutreachStatus } from '../../types/outreach.types'

const STATUS_ICON: Record<OutreachStatus, React.ReactNode> = {
  queued: <Clock className="w-3.5 h-3.5 text-zinc-500" />,
  sent: <CheckCircle className="w-3.5 h-3.5 text-blue-400" />,
  delivered: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  opened: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  replied: <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />,
  bounced: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-400" />
}

function StepDot({ status }: { status: OutreachStatus | null }) {
  if (!status) return <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700" />
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-zinc-800">
      {STATUS_ICON[status]}
    </div>
  )
}

export function SequencePanel() {
  const { sequences, fetchSequences, records, fetchAll, markReplied, markBounced } =
    useOutreachStore()

  useEffect(() => {
    fetchAll()
    fetchSequences()
  }, [])

  if (sequences.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        No sequences scheduled yet. Send outreach from the Queue tab.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sequences.map((seq) => {
        const seqRecords = records.filter((r) => r.lead_id === seq.lead_id)
        const latestSent = seqRecords.find((r) => r.status === 'sent')

        return (
          <div
            key={seq.lead_id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm font-medium text-zinc-200">{seq.business_name}</p>

                {/* Step indicators */}
                <div className="flex items-center gap-1.5">
                  <StepDot status={seq.step1_status} />
                  <div className="w-4 h-px bg-zinc-700" />
                  <StepDot status={seq.step2_status} />
                  <div className="w-4 h-px bg-zinc-700" />
                  <StepDot status={seq.step3_status} />
                </div>

                {seq.next_scheduled && (
                  <span className="text-xs text-zinc-500">
                    Next: {new Date(seq.next_scheduled).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {latestSent && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await markReplied(latestSent.id)
                        toast.success('Marked as replied')
                      }}
                    >
                      Replied ✓
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await markBounced(latestSent.id)
                        toast('Marked as bounced')
                      }}
                    >
                      Bounced
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
      
      <div className="mt-4 border border-zinc-800 rounded-xl overflow-hidden">
        <Pagination
          page={useOutreachStore.getState().page}
          pageSize={useOutreachStore.getState().pageSize}
          total={useOutreachStore.getState().total}
          onPageChange={(page) => useOutreachStore.getState().setPagination(page)}
          onPageSizeChange={(pageSize) => useOutreachStore.getState().setPagination(1, pageSize)}
        />
      </div>
    </div>
  )
}
