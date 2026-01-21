'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MoreVertical, Send, Bot, User, Phone, Info, Loader2, AlertCircle } from 'lucide-react'
import { useAttendant } from '@/components/attendant/AttendantProvider'
import { toast } from 'sonner'
import {
  getStatusEmoji,
  getStatusLabel,
  getStatusColor,
  type TelegramConversationStatus,
} from '@/hooks/telegram'

// =============================================================================
// TYPES
// =============================================================================

interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content: string
  message_type: string
  wa_message_id: string | null
  delivery_status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  is_ai_generated: boolean
  created_at: string
}

interface Conversation {
  id: string
  contact_name: string
  contact_phone: string
  status: string
  mode: 'bot' | 'human'
  priority: string | null
  ai_agent_id: string | null
  ai_agent_name: string | null
  last_message_at: string
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchConversation(id: string): Promise<Conversation> {
  const res = await fetch(`/api/inbox/conversations/${id}`)
  if (!res.ok) throw new Error('Conversa não encontrada')
  return res.json()
}

async function fetchMessages(id: string, limit = 50): Promise<{ messages: Message[]; hasMore: boolean }> {
  const res = await fetch(`/api/inbox/conversations/${id}/messages?limit=${limit}`)
  if (!res.ok) throw new Error('Erro ao buscar mensagens')
  return res.json()
}

async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const res = await fetch(`/api/inbox/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, message_type: 'text' }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Erro ao enviar mensagem')
  }
  return res.json()
}

async function takeoverConversation(id: string): Promise<void> {
  const res = await fetch(`/api/inbox/conversations/${id}/takeover`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Erro ao assumir conversa')
}

async function returnToBot(id: string): Promise<void> {
  const res = await fetch(`/api/inbox/conversations/${id}/return-to-bot`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Erro ao devolver para IA')
}

// =============================================================================
// HELPER: Map status
// =============================================================================

function mapConversationStatus(conv: Conversation): TelegramConversationStatus {
  if (conv.priority === 'urgent') return 'handoff_requested'
  if (conv.mode === 'human') return 'human_active'
  if (conv.mode === 'bot') return 'ai_active'
  return 'resolved'
}

// =============================================================================
// COMPONENTS
// =============================================================================

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusIcon = (status: Message['delivery_status']) => {
    switch (status) {
      case 'read':
        return '✓✓'
      case 'delivered':
        return '✓✓'
      case 'sent':
        return '✓'
      case 'pending':
        return '⏳'
      case 'failed':
        return '❌'
      default:
        return ''
    }
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`
          max-w-[80%] px-3 py-2 rounded-2xl
          ${isOutbound
            ? 'bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] rounded-br-md'
            : 'bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] rounded-bl-md'
          }
        `}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          {message.is_ai_generated && (
            <Bot size={12} className="opacity-60" />
          )}
          <span className="text-[10px] opacity-60">{formatTime(message.created_at)}</span>
          {isOutbound && (
            <span className={`text-[10px] ${message.delivery_status === 'read' ? 'text-blue-300' : 'opacity-60'}`}>
              {getStatusIcon(message.delivery_status)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBanner({ status }: { status: TelegramConversationStatus }) {
  const isUrgent = status === 'handoff_requested'
  const isHuman = status === 'human_active'

  if (status === 'resolved') return null

  return (
    <div className={`
      px-4 py-2 flex items-center justify-between
      ${isUrgent ? 'bg-red-500/10' : isHuman ? 'bg-green-500/10' : 'bg-blue-500/10'}
    `}>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${getStatusColor(status)}`}>
          {getStatusEmoji(status)} {getStatusLabel(status)}
        </span>
      </div>
      {isUrgent && (
        <span className="text-xs text-red-400">Cliente aguardando</span>
      )}
    </div>
  )
}

function ActionButtons({
  status,
  onTakeOver,
  onReturnToAI,
  isLoading,
  canReply,
  canHandoff,
}: {
  status: TelegramConversationStatus
  onTakeOver: () => void
  onReturnToAI: () => void
  isLoading: boolean
  canReply: boolean
  canHandoff: boolean
}) {
  const isAIActive = status === 'ai_active' || status === 'handoff_requested'

  // Sem permissão de responder, não mostra botões
  if (!canReply) return null

  return (
    <div className="flex gap-2 px-4 py-2 border-b border-[var(--tg-theme-secondary-bg-color)]">
      {isAIActive ? (
        <button
          onClick={onTakeOver}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <User size={16} />
          )}
          Assumir Atendimento
        </button>
      ) : canHandoff ? (
        <button
          onClick={onReturnToAI}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Bot size={16} />
          )}
          Devolver para IA
        </button>
      ) : (
        <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/10 text-green-400 text-sm">
          <User size={16} />
          Você está atendendo
        </div>
      )}
      <button
        className="px-3 py-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-hint-color)] hover:text-[var(--tg-theme-text-color)] transition-colors"
      >
        <Info size={16} />
      </button>
    </div>
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ConversaPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAuthenticated, attendant, canReply, canHandoff } = useAttendant()

  const conversationId = params.id as string
  const [newMessage, setNewMessage] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch conversation
  const {
    data: conversation,
    isLoading: convLoading,
    error: convError,
  } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => fetchConversation(conversationId),
    enabled: isAuthenticated,
    refetchInterval: 5000, // Poll every 5s
  })

  // Fetch messages
  const {
    data: messagesData,
    isLoading: msgsLoading,
  } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => fetchMessages(conversationId, 100),
    enabled: isAuthenticated,
    refetchInterval: 3000, // Poll every 3s
  })

  const messages = messagesData?.messages ?? []
  const status = conversation ? mapConversationStatus(conversation) : 'ai_active'

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(conversationId, content),
    onSuccess: () => {
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Takeover mutation
  const takeoverMutation = useMutation({
    mutationFn: () => takeoverConversation(conversationId),
    onSuccess: () => {
      toast.success('Você assumiu o atendimento!')
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Return to bot mutation
  const returnMutation = useMutation({
    mutationFn: () => returnToBot(conversationId),
    onSuccess: () => {
      toast.success('Conversa devolvida para IA')
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [newMessage])

  const handleSend = useCallback(() => {
    if (!newMessage.trim() || sendMutation.isPending) return
    sendMutation.mutate(newMessage.trim())
  }, [newMessage, sendMutation])

  // Loading state
  if (convLoading || msgsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--tg-theme-button-color)]" />
      </div>
    )
  }

  // Error state
  if (convError || !conversation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-lg font-medium mb-2">Conversa não encontrada</h2>
        <button
          onClick={() => router.push('/atendimento')}
          className="text-[var(--tg-theme-link-color)] text-sm"
        >
          Voltar para lista
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="shrink-0 px-2 py-3 border-b border-[var(--tg-theme-secondary-bg-color)] bg-[var(--tg-theme-bg-color)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/atendimento')}
            className="p-2 rounded-lg hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="w-10 h-10 rounded-full bg-[var(--tg-theme-secondary-bg-color)] flex items-center justify-center text-sm font-medium shrink-0">
            {conversation.contact_name?.charAt(0).toUpperCase() || '?'}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-medium truncate">{conversation.contact_name || 'Desconhecido'}</h1>
            <p className="text-xs text-[var(--tg-theme-hint-color)] truncate">
              {conversation.contact_phone}
            </p>
          </div>

          <button className="p-2 rounded-lg hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
            <Phone size={20} className="text-[var(--tg-theme-hint-color)]" />
          </button>
          <button className="p-2 rounded-lg hover:bg-[var(--tg-theme-secondary-bg-color)] transition-colors">
            <MoreVertical size={20} className="text-[var(--tg-theme-hint-color)]" />
          </button>
        </div>
      </header>

      {/* Status banner */}
      <StatusBanner status={status} />

      {/* Action buttons */}
      <ActionButtons
        status={status}
        onTakeOver={() => takeoverMutation.mutate()}
        onReturnToAI={() => returnMutation.mutate()}
        isLoading={takeoverMutation.isPending || returnMutation.isPending}
        canReply={canReply}
        canHandoff={canHandoff}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--tg-theme-hint-color)]">
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          // Mostrar mensagens do mais antigo para o mais novo
          [...messages].reverse().map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {canReply && status === 'human_active' && (
        <div className="shrink-0 px-4 py-3 border-t border-[var(--tg-theme-secondary-bg-color)] bg-[var(--tg-theme-bg-color)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Digite uma mensagem..."
              rows={1}
              className="flex-1 px-4 py-2.5 rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] placeholder:text-[var(--tg-theme-hint-color)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]/50 max-h-[120px]"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMutation.isPending}
              className="w-10 h-10 rounded-full bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {sendMutation.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Read-only notice */}
      {!canReply && (
        <div className="shrink-0 px-4 py-3 border-t border-[var(--tg-theme-secondary-bg-color)] bg-[var(--tg-theme-secondary-bg-color)]/50 text-center">
          <p className="text-sm text-[var(--tg-theme-hint-color)]">
            Você tem permissão apenas para visualizar
          </p>
        </div>
      )}

      {/* Waiting for human notice */}
      {canReply && status !== 'human_active' && (
        <div className="shrink-0 px-4 py-3 border-t border-[var(--tg-theme-secondary-bg-color)] bg-[var(--tg-theme-secondary-bg-color)]/50 text-center">
          <p className="text-sm text-[var(--tg-theme-hint-color)]">
            Assuma o atendimento para enviar mensagens
          </p>
        </div>
      )}
    </div>
  )
}
