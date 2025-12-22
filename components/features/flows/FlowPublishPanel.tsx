'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { flowsService, type FlowRow } from '@/services/flowsService'

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('pt-BR')
}

function statusInfo(flow: FlowRow): { label: string; className: string } {
  const metaStatus = String(flow.meta_status || '').toUpperCase()
  const hasErrors = Array.isArray(flow.meta_validation_errors)
    ? flow.meta_validation_errors.length > 0
    : !!flow.meta_validation_errors

  if (metaStatus === 'PUBLISHED') {
    return { label: 'Publicado', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' }
  }

  if (metaStatus === 'REJECTED' || metaStatus === 'ERROR' || hasErrors) {
    return { label: 'Requer ação', className: 'bg-red-500/10 text-red-300 border-red-500/20' }
  }

  if (metaStatus === 'PENDING' || metaStatus === 'IN_REVIEW') {
    return { label: 'Em revisão', className: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' }
  }

  if (metaStatus) {
    return { label: metaStatus, className: 'bg-blue-500/10 text-blue-300 border-blue-500/20' }
  }

  return { label: 'Rascunho', className: 'bg-white/5 text-gray-300 border-white/10' }
}

export function FlowPublishPanel({
  flows,
  isLoading,
  isFetching,
  onRefresh,
  onSelectTestFlowId,
}: {
  flows: FlowRow[]
  isLoading: boolean
  isFetching: boolean
  onRefresh: () => void
  onSelectTestFlowId?: (metaFlowId: string) => void
}) {
  const queryClient = useQueryClient()
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmFlow, setConfirmFlow] = useState<FlowRow | null>(null)

  const sortedFlows = useMemo(() => {
    const rows = [...(flows || [])]
    rows.sort((a, b) => {
      const da = new Date(a.updated_at || a.created_at).getTime()
      const db = new Date(b.updated_at || b.created_at).getTime()
      return db - da
    })
    return rows
  }, [flows])

  const visibleFlows = sortedFlows.slice(0, 3)

  const handlePublish = async (flow: FlowRow) => {
    try {
      setPublishingId(flow.id)
      await flowsService.publishToMeta(flow.id, {
        publish: true,
        categories: ['OTHER'],
        updateIfExists: true,
      })
      toast.success('Flow publicado na Meta')
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao publicar na Meta')
    } finally {
      setPublishingId(null)
    }
  }

  const handleDelete = async (flow: FlowRow) => {
    try {
      setDeletingId(flow.id)
      await flowsService.remove(flow.id)
      toast.success('Flow excluido')
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir flow')
    } finally {
      setDeletingId(null)
      setConfirmFlow(null)
    }
  }

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">2. Publicar</div>
          <div className="text-xs text-gray-400 mt-1">Envie o Flow para a Meta e obtenha o flow_id.</div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={isLoading || isFetching}
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      <div className="text-xs text-gray-500">
        {isLoading ? 'Carregando…' : `Mostrando ${visibleFlows.length} de ${sortedFlows.length} flow(s)`}
        {isFetching && !isLoading ? ' (atualizando…)': ''}
      </div>

      {sortedFlows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 text-sm text-gray-400">
          Nenhum Flow ainda. Crie no Builder para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleFlows.map((flow) => {
            const status = statusInfo(flow)
            const isPublishing = publishingId === flow.id
            const isDeleting = deletingId === flow.id
            const canTest = !!flow.meta_flow_id && !!onSelectTestFlowId
            return (
              <div key={flow.id} className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{flow.name}</div>
                    <div className="text-[11px] text-gray-500">Atualizado {formatDateTime(flow.updated_at || flow.created_at)}</div>
                  </div>
                  <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border', status.className)}>
                    {status.label}
                  </span>
                </div>

                <div className="text-xs text-gray-400 font-mono">Meta Flow ID: {flow.meta_flow_id || '—'}</div>

                {flow.meta_preview_url ? (
                  <a
                    className="inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white underline underline-offset-2"
                    href={String(flow.meta_preview_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir preview
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handlePublish(flow)}
                    disabled={isPublishing}
                    className="bg-primary-600 hover:bg-primary-500 text-white"
                  >
                    <UploadCloud className={cn('h-4 w-4', isPublishing ? 'animate-pulse' : '')} />
                    {isPublishing ? 'Publicando…' : (status.label === 'Publicado' ? 'Atualizar' : 'Publicar')}
                  </Button>
                  <Link href={`/flows/builder/${encodeURIComponent(flow.id)}`}>
                    <Button size="sm" variant="secondary">
                      Abrir Builder
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => flow.meta_flow_id && onSelectTestFlowId?.(String(flow.meta_flow_id))}
                    disabled={!canTest}
                  >
                    Testar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmFlow(flow)}
                    disabled={isDeleting}
                    className="text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            )
          })}

          {sortedFlows.length > visibleFlows.length && (
            <div className="text-xs text-gray-500">
              Mostrando {visibleFlows.length} de {sortedFlows.length}. Abra o Builder para ver todos.
            </div>
          )}
        </div>
      )}

      <Dialog open={!!confirmFlow} onOpenChange={(open) => !open && setConfirmFlow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir flow</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-300">
            Flow: <span className="font-semibold">{confirmFlow?.name}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFlow(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmFlow && handleDelete(confirmFlow)}
              disabled={!confirmFlow || deletingId === confirmFlow.id}
            >
              {deletingId === confirmFlow?.id ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
