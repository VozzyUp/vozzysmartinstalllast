'use client'

import React, { useMemo } from 'react'
import { X, MoreVertical } from 'lucide-react'

type FlowComponent = Record<string, any>

type ParsedFlow = {
  version?: string
  screen?: {
    id?: string
    title?: string
    terminal?: boolean
    layout?: {
      type?: string
      children?: FlowComponent[]
    }
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function parseFlowJson(flowJson: unknown): ParsedFlow {
  if (!isPlainObject(flowJson)) return {}

  const screens = Array.isArray((flowJson as any).screens) ? (flowJson as any).screens : []
  const screen = screens[0]
  const layout = isPlainObject(screen?.layout) ? screen.layout : undefined

  return {
    version: typeof (flowJson as any).version === 'string' ? (flowJson as any).version : undefined,
    screen: isPlainObject(screen)
      ? {
          id: typeof screen.id === 'string' ? screen.id : undefined,
          title: typeof screen.title === 'string' ? screen.title : undefined,
          terminal: typeof screen.terminal === 'boolean' ? screen.terminal : undefined,
          layout: layout
            ? {
                type: typeof (layout as any).type === 'string' ? (layout as any).type : undefined,
                children: Array.isArray((layout as any).children) ? (layout as any).children : [],
              }
            : undefined,
        }
      : undefined,
  }
}

function s(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function getFooter(children: FlowComponent[]): { label: string; disabled: boolean } {
  const footer = children.find((c) => c && c.type === 'Footer')
  const label = (footer ? s(footer.label, '') : '').trim() || 'Continue'
  // No preview da Meta o CTA aparece frequentemente desabilitado.
  const disabled = true
  return { label, disabled }
}

function renderBasicText(text: string, idx: number) {
  const t = text.trim()
  if (!t) return null
  return (
    <div key={`bt_${idx}`} className="text-[14px] leading-snug text-zinc-100 whitespace-pre-wrap">
      {t}
    </div>
  )
}

function renderTextEntry(comp: FlowComponent, idx: number) {
  const label = (s(comp.label, 'Campo') || 'Campo').trim()
  return (
    <div key={`te_${idx}`} className="space-y-2">
      <div className="h-12 rounded-lg border border-white/15 bg-white/5 px-4 flex items-center text-[16px] text-zinc-400">
        {label}
      </div>
    </div>
  )
}

function renderOptIn(comp: FlowComponent, idx: number) {
  const text = (s(comp.text, '') || '').trim()
  if (!text) return null

  // Heurística simples pra ficar parecido com os prints: realçar “Leia mais”.
  const parts = text.split(/(Leia mais)/i)

  return (
    <div key={`oi_${idx}`} className="flex items-start gap-3">
      <div className="mt-1 h-5 w-5 rounded border border-white/30 bg-white/5" />
      <div className="text-[15px] text-zinc-300 leading-snug">
        {parts.map((p, i) => {
          if (/^Leia mais$/i.test(p)) {
            return (
              <span key={i} className="text-emerald-400">
                {p}
              </span>
            )
          }
          return <React.Fragment key={i}>{p}</React.Fragment>
        })}
      </div>
    </div>
  )
}

function renderRadioGroup(comp: FlowComponent, idx: number) {
  const label = (s(comp.label, '') || '').trim()
  const options = Array.isArray(comp.options) ? comp.options : []

  return (
    <div key={`rg_${idx}`} className="space-y-3">
      {label ? <div className="text-[18px] font-semibold text-zinc-100">{label}</div> : null}
      <div className="space-y-5">
        {(options.length ? options : [{ id: 'opcao_1', title: 'Opção 1' }]).map((o: any, j: number) => (
          <div key={`rg_${idx}_${j}`} className="flex items-center justify-between gap-4">
            <div className="text-[18px] text-zinc-300">{s(o?.title, 'Opção')}</div>
            <div className="h-6 w-6 rounded-full border border-white/30" />
          </div>
        ))}
      </div>
    </div>
  )
}

function renderCheckboxGroup(comp: FlowComponent, idx: number) {
  const label = (s(comp.label, '') || '').trim()
  const options = Array.isArray(comp.options) ? comp.options : []

  return (
    <div key={`cg_${idx}`} className="space-y-3">
      {label ? <div className="text-[18px] font-semibold text-zinc-100">{label}</div> : null}
      <div className="space-y-5">
        {(options.length ? options : [{ id: 'opcao_1', title: 'Opção 1' }]).map((o: any, j: number) => (
          <div key={`cg_${idx}_${j}`} className="flex items-center justify-between gap-4">
            <div className="text-[18px] text-zinc-300">{s(o?.title, 'Opção')}</div>
            <div className="h-6 w-6 rounded border border-white/30" />
          </div>
        ))}
      </div>
    </div>
  )
}

function renderDropdown(comp: FlowComponent, idx: number) {
  const label = (s(comp.label, '') || 'Select').trim()
  return (
    <div key={`dd_${idx}`} className="space-y-2">
      <div className="h-12 rounded-lg border border-white/15 bg-white/5 px-4 flex items-center text-[16px] text-zinc-400">
        {label}
      </div>
    </div>
  )
}

function renderDatePicker(comp: FlowComponent, idx: number) {
  const label = (s(comp.label, '') || 'Date').trim()
  return (
    <div key={`dp_${idx}`} className="space-y-2">
      <div className="h-12 rounded-lg border border-white/15 bg-white/5 px-4 flex items-center text-[16px] text-zinc-400">
        {label}
      </div>
    </div>
  )
}

function renderComponent(comp: FlowComponent, idx: number) {
  const type = s(comp?.type, '')

  if (type === 'BasicText') return renderBasicText(s(comp.text, ''), idx)
  if (type === 'TextEntry') return renderTextEntry(comp, idx)
  if (type === 'OptIn') return renderOptIn(comp, idx)
  if (type === 'RadioButtonsGroup') return renderRadioGroup(comp, idx)
  if (type === 'CheckboxGroup') return renderCheckboxGroup(comp, idx)
  if (type === 'Dropdown') return renderDropdown(comp, idx)
  if (type === 'DatePicker') return renderDatePicker(comp, idx)

  return null
}

export function MetaFlowPreview(props: {
  flowJson: unknown
  className?: string
}) {
  const parsed = useMemo(() => parseFlowJson(props.flowJson), [props.flowJson])

  const children = parsed.screen?.layout?.children || []
  const footer = getFooter(children)

  const title = (parsed.screen?.title || 'Flow').trim() || 'Flow'

  return (
    <div className={`relative mx-auto w-[320px] h-160 rounded-[2.2rem] bg-zinc-950 border-8 border-zinc-900 shadow-2xl overflow-hidden ${props.className || ''}`}>
      {/* topo do "telefone" */}
      <div className="h-10 bg-zinc-950" />

      {/* modal do flow (como no WhatsApp) */}
      <div className="absolute inset-x-0 top-6 bottom-0 rounded-t-2xl bg-[#1f2223] border-t border-white/10 overflow-hidden">
        {/* topbar */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
          <button type="button" className="h-9 w-9 rounded-full hover:bg-white/5 flex items-center justify-center text-zinc-200">
            <X className="h-5 w-5" />
          </button>
          <div className="text-[18px] font-semibold text-zinc-100 truncate">{title}</div>
          <button type="button" className="h-9 w-9 rounded-full hover:bg-white/5 flex items-center justify-center text-zinc-200">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>

        {/* conteúdo */}
        <div className="px-5 py-5 space-y-6 overflow-auto" style={{ height: 'calc(100% - 14rem)' }}>
          {children.filter((c) => c?.type !== 'Footer').map((c, idx) => renderComponent(c, idx))}
        </div>

        {/* CTA + compliance */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 pt-4 bg-linear-to-t from-[#1f2223] via-[#1f2223] to-transparent">
          <button
            type="button"
            disabled={footer.disabled}
            className="w-full h-12 rounded-2xl bg-white/10 text-white/25 text-[16px] font-semibold"
          >
            {footer.label}
          </button>

          <div className="mt-4 text-center text-[14px] text-zinc-400">
            Gerenciada pela empresa. <span className="text-emerald-400">Saiba mais</span>
          </div>
          <div className="mt-1 text-center text-[10px] text-zinc-500">preview Meta • v{parsed.version || '—'}</div>
        </div>
      </div>
    </div>
  )
}

export default MetaFlowPreview
