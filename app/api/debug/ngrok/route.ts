import { NextRequest, NextResponse } from 'next/server'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

export const runtime = 'nodejs'

type NgrokState = {
  port: number
  lastTunnelName: string | null
  lastPublicUrl: string | null
}

const ngrokState: NgrokState = {
  port: 3000,
  lastTunnelName: null,
  lastPublicUrl: null,
}

const NGROK_API = 'http://127.0.0.1:4040/api'
let ngrokProcess: ChildProcess | null = null

type NgrokTunnel = {
  name?: string
  public_url?: string
  proto?: string
  config?: { addr?: string }
}

async function getNgrokTunnels() {
  try {
    const res = await fetch(`${NGROK_API}/tunnels`, { method: 'GET' })
    if (!res.ok) return { tunnels: null, error: `status:${res.status}` }
    const data = (await res.json()) as { tunnels?: NgrokTunnel[] }
    return { tunnels: data?.tunnels || [], error: null }
  } catch {
    return { tunnels: null, error: 'unreachable' }
  }
}

function ensureDev() {
  return process.env.NODE_ENV === 'development'
}

function checkBinary(cmd: string): { ok: boolean; error: string | null } {
  try {
    const result = spawnSync(cmd, ['version'], { stdio: 'ignore' })
    if (result.error) return { ok: false, error: result.error.message }
    return { ok: result.status === 0, error: result.status === 0 ? null : `status:${result.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

function normalizeAddr(addr: string | undefined | null): string {
  if (!addr) return ''
  const raw = String(addr)
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  if (/^\d+$/.test(raw)) return `http://localhost:${raw}`
  if (raw.startsWith('localhost:')) return `http://${raw}`
  return raw
}

function pickTunnelForPort(tunnels: NgrokTunnel[], port: number): NgrokTunnel | null {
  const portStr = String(port)
  const exact = tunnels.find((t) => normalizeAddr(t.config?.addr).includes(`:${portStr}`))
  if (exact) return exact
  return tunnels[0] || null
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function startNgrokProcess(port: number) {
  if (ngrokProcess && !ngrokProcess.killed) return
  ngrokProcess = spawn('ngrok', ['http', String(port)], {
    stdio: 'ignore',
    shell: false,
  })
  ngrokProcess.on('exit', () => {
    ngrokProcess = null
  })
}

async function ensureNgrokStarted(port: number) {
  const { tunnels, error } = await getNgrokTunnels()
  if (tunnels && tunnels.length > 0) return { ok: true, error: null }
  if (error === 'unreachable') {
    const ngrokBinary = checkBinary('ngrok')
    if (!ngrokBinary.ok) return { ok: false, error: 'ngrok-missing' }
    startNgrokProcess(port)
    for (let i = 0; i < 8; i += 1) {
      await wait(250)
      const next = await getNgrokTunnels()
      if (next.tunnels && next.tunnels.length > 0) return { ok: true, error: null }
    }
    return { ok: false, error: 'ngrok-start-timeout' }
  }
  return { ok: false, error: error || 'unknown' }
}

export async function GET(req: NextRequest) {
  if (!ensureDev()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { searchParams } = new URL(req.url)
  const autostart = searchParams.get('autostart') === '1'
  if (autostart) {
    await ensureNgrokStarted(ngrokState.port)
  }
  const { tunnels, error } = await getNgrokTunnels()
  const tunnel = tunnels ? pickTunnelForPort(tunnels, ngrokState.port) : null
  const publicUrl = tunnel?.public_url || ngrokState.lastPublicUrl || null
  const isRunning = !!tunnel?.public_url
  if (tunnel?.name) ngrokState.lastTunnelName = tunnel.name
  if (publicUrl) ngrokState.lastPublicUrl = publicUrl
  const ngrokBinary = checkBinary('ngrok')
  const cloudflaredBinary = checkBinary('cloudflared')
  return NextResponse.json({
    running: isRunning,
    port: ngrokState.port,
    publicUrl,
    tunnelName: tunnel?.name || ngrokState.lastTunnelName,
    hasApi: !!tunnels,
    apiError: error,
    binaries: {
      ngrok: ngrokBinary.ok,
      cloudflared: cloudflaredBinary.ok,
      ngrokError: ngrokBinary.error,
      cloudflaredError: cloudflaredBinary.error,
    },
  })
}

export async function POST(req: NextRequest) {
  if (!ensureDev()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const port = Number.isFinite(body?.port) ? Number(body.port) : 3000
  ngrokState.port = port
  const startAttempt = await ensureNgrokStarted(port)
  if (!startAttempt.ok) {
    return NextResponse.json(
      { error: 'Ngrok não está disponível', apiError: startAttempt.error },
      { status: 400 }
    )
  }
  const { tunnels } = await getNgrokTunnels()
  if (!tunnels) {
    return NextResponse.json({ error: 'Ngrok não está disponível', apiError: 'unreachable' }, { status: 400 })
  }
  const existing = pickTunnelForPort(tunnels, port)
  if (existing?.public_url) {
    ngrokState.lastTunnelName = existing.name || ngrokState.lastTunnelName
    ngrokState.lastPublicUrl = existing.public_url || ngrokState.lastPublicUrl
    return NextResponse.json({
      running: true,
      port,
      publicUrl: existing.public_url,
      tunnelName: existing.name,
    })
  }
  const name = `smartzap_dev_${port}`
  const res = await fetch(`${NGROK_API}/tunnels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      proto: 'http',
      addr: `http://localhost:${port}`,
    }),
  })
  if (!res.ok) {
    return NextResponse.json({ error: 'Falha ao iniciar túnel no ngrok', apiError: `status:${res.status}` }, { status: 400 })
  }
  const created = (await res.json()) as NgrokTunnel
  if (created?.name) ngrokState.lastTunnelName = created.name
  if (created?.public_url) ngrokState.lastPublicUrl = created.public_url
  return NextResponse.json({
    running: true,
    port,
    publicUrl: created.public_url || null,
    tunnelName: created.name || null,
  })
}

export async function DELETE() {
  if (!ensureDev()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { tunnels } = await getNgrokTunnels()
  const tunnel = tunnels ? pickTunnelForPort(tunnels, ngrokState.port) : null
  const name = tunnel?.name || ngrokState.lastTunnelName
  if (name) {
    await fetch(`${NGROK_API}/tunnels/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => null)
  }
  if (ngrokProcess && !ngrokProcess.killed) {
    try {
      ngrokProcess.kill()
    } catch {}
    ngrokProcess = null
  }
  ngrokState.lastTunnelName = null
  ngrokState.lastPublicUrl = null
  return NextResponse.json({ stopped: true })
}
