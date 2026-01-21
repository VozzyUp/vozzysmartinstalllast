'use client'

import { ReactNode, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AttendantProvider } from '@/components/attendant/AttendantProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

// =============================================================================
// Query Client (standalone para esta rota)
// =============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10, // 10 segundos
      refetchOnWindowFocus: true,
    },
  },
})

// =============================================================================
// Layout Interno (com acesso aos search params)
// =============================================================================

function AttendimentoLayoutInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  return (
    <AttendantProvider token={token}>
      <div
        className="min-h-screen"
        style={{
          backgroundColor: '#18181b',
          color: '#fafafa',
        }}
      >
        {/* CSS Variables para consistência com o Mini App */}
        <style jsx global>{`
          :root {
            --tg-theme-bg-color: #18181b;
            --tg-theme-text-color: #fafafa;
            --tg-theme-hint-color: #a1a1aa;
            --tg-theme-link-color: #60a5fa;
            --tg-theme-button-color: #22c55e;
            --tg-theme-button-text-color: #ffffff;
            --tg-theme-secondary-bg-color: #27272a;
          }

          body {
            background-color: #18181b;
            color: #fafafa;
            font-family: system-ui, -apple-system, sans-serif;
          }

          .dark {
            color-scheme: dark;
          }
        `}</style>
        {children}
      </div>
    </AttendantProvider>
  )
}

// =============================================================================
// Layout Principal
// =============================================================================

export default function AtendimentoLayout({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense
        fallback={
          <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        }
      >
        <AttendimentoLayoutInner>{children}</AttendimentoLayoutInner>
      </Suspense>
    </QueryClientProvider>
  )
}
