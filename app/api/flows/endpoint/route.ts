/**
 * WhatsApp Flow Endpoint
 *
 * Endpoint para data_exchange em WhatsApp Flows.
 * Recebe requests criptografadas da Meta e responde com dados dinamicos.
 *
 * POST /api/flows/endpoint
 *
 * Handlers:
 * - ping: health check
 * - INIT: primeira tela do flow
 * - data_exchange: interacao do usuario
 * - BACK: usuario voltou para tela anterior
 */

import { NextRequest, NextResponse } from 'next/server'
import { settingsDb } from '@/lib/supabase-db'
import {
  decryptRequest,
  encryptResponse,
  createErrorResponse,
  type FlowDataExchangeRequest,
} from '@/lib/whatsapp/flow-endpoint-crypto'
import { handleFlowAction } from '@/lib/whatsapp/flow-endpoint-handlers'

const PRIVATE_KEY_SETTING = 'whatsapp_flow_private_key'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Valida campos obrigatorios
    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = body
    if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
      console.error('[flow-endpoint] Campos obrigatorios ausentes')
      return NextResponse.json({ error: 'Campos obrigatorios ausentes' }, { status: 400 })
    }

    // Busca a chave privada
    const privateKey = await settingsDb.get(PRIVATE_KEY_SETTING)
    if (!privateKey) {
      console.error('[flow-endpoint] Chave privada nao configurada')
      return NextResponse.json({ error: 'Endpoint nao configurado' }, { status: 500 })
    }

    // Descriptografa a request
    let decrypted
    try {
      decrypted = decryptRequest(
        { encrypted_flow_data, encrypted_aes_key, initial_vector },
        privateKey
      )
    } catch (error) {
      console.error('[flow-endpoint] Erro ao descriptografar:', error)
      return NextResponse.json({ error: 'Falha na descriptografia' }, { status: 421 })
    }

    const flowRequest = decrypted.decryptedBody as unknown as FlowDataExchangeRequest
    console.log('[flow-endpoint] Action:', flowRequest.action, 'Screen:', flowRequest.screen)

    // Health check - nao precisa criptografar response
    if (flowRequest.action === 'ping') {
      return NextResponse.json({ data: { status: 'active' } })
    }

    // Processa a acao do flow
    let response
    try {
      response = await handleFlowAction(flowRequest)
    } catch (error) {
      console.error('[flow-endpoint] Erro no handler:', error)
      response = createErrorResponse(
        error instanceof Error ? error.message : 'Erro interno'
      )
    }

    // Criptografa a response
    const encryptedResponse = encryptResponse(
      response,
      decrypted.aesKeyBuffer,
      decrypted.initialVectorBuffer
    )

    return new NextResponse(encryptedResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (error) {
    console.error('[flow-endpoint] Erro geral:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

/**
 * GET - Health check simples (sem criptografia)
 */
export async function GET() {
  const privateKey = await settingsDb.get(PRIVATE_KEY_SETTING)
  const configured = !!privateKey

  return NextResponse.json({
    status: configured ? 'ready' : 'not_configured',
    message: configured
      ? 'Flow endpoint configurado e pronto'
      : 'Chave privada nao configurada. Configure em /settings/flows',
  })
}
