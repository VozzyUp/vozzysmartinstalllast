/**
 * AI Provider Factory
 *
 * Factory para criar modelos de IA de diferentes providers (Google, OpenAI, Anthropic).
 * Usado pelos agentes de IA para suportar múltiplos providers com a mesma interface.
 *
 * O Vercel AI SDK garante que tools funcionam de forma idêntica em todos os providers.
 *
 * Suporta Helicone como proxy para observability (configurável via settings).
 */

import type { LanguageModel } from 'ai'
import { getSupabaseAdmin } from '@/lib/supabase'

// =============================================================================
// Helicone Configuration
// =============================================================================

// Helicone gateway config por provider
// Para Google: usar gateway genérico + Helicone-Target-URL header
// Para OpenAI/Anthropic: usar gateways dedicados
const HELICONE_GATEWAYS: Record<AIProvider, { baseURL: string; targetURL?: string }> = {
  google: {
    baseURL: 'https://gateway.helicone.ai/v1beta',
    targetURL: 'https://generativelanguage.googleapis.com/v1beta',
  },
  openai: {
    baseURL: 'https://oai.helicone.ai/v1',
  },
  anthropic: {
    baseURL: 'https://anthropic.helicone.ai/v1',
  },
}

/**
 * Busca configuração do Helicone do banco de dados.
 * Retorna null se não configurado ou desabilitado.
 */
async function getHeliconeConfig(): Promise<{ apiKey: string } | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['helicone_enabled', 'helicone_api_key'])

    if (!settings || settings.length === 0) return null

    const configMap = Object.fromEntries(settings.map(s => [s.key, s.value]))
    const enabled = configMap['helicone_enabled'] === 'true'
    const apiKey = configMap['helicone_api_key']

    if (!enabled || !apiKey) return null

    return { apiKey }
  } catch (error) {
    console.error('[provider-factory] Error fetching Helicone config:', error)
    return null
  }
}

// =============================================================================
// Types
// =============================================================================

export type AIProvider = 'google' | 'openai' | 'anthropic'

export interface ProviderConfig {
  provider: AIProvider
  model: string
  apiKey: string
}

// Mapeamento de provider para chave de API na tabela settings
const PROVIDER_API_KEY_MAP: Record<AIProvider, { settingKey: string; envVar: string }> = {
  google: { settingKey: 'gemini_api_key', envVar: 'GEMINI_API_KEY' },
  openai: { settingKey: 'openai_api_key', envVar: 'OPENAI_API_KEY' },
  anthropic: { settingKey: 'anthropic_api_key', envVar: 'ANTHROPIC_API_KEY' },
}

// =============================================================================
// Provider Detection
// =============================================================================

/**
 * Detecta o provider baseado no nome do modelo.
 *
 * - gemini-* → google
 * - gpt-* → openai
 * - claude-* → anthropic
 */
export function getProviderFromModel(modelId: string): AIProvider {
  if (modelId.startsWith('gemini')) return 'google'
  if (modelId.startsWith('gpt')) return 'openai'
  if (modelId.startsWith('claude')) return 'anthropic'
  return 'google' // default
}

// =============================================================================
// API Key Fetching
// =============================================================================

/**
 * Busca a API key do provider no banco de dados ou variáveis de ambiente.
 */
export async function getProviderApiKey(provider: AIProvider): Promise<string | null> {
  const config = PROVIDER_API_KEY_MAP[provider]

  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', config.settingKey)
      .maybeSingle()

    if (data?.value) {
      return data.value
    }
  }

  // Fallback para variável de ambiente
  return process.env[config.envVar] || null
}

// =============================================================================
// Model Factory
// =============================================================================

/**
 * Cria um modelo de linguagem do provider apropriado.
 *
 * Esta função é provider-agnostic - retorna um modelo compatível com
 * generateText/streamText que funciona com tools de forma idêntica.
 */
export async function createLanguageModel(
  modelId: string,
  apiKeyOverride?: string
): Promise<{ model: LanguageModel; provider: AIProvider; apiKey: string }> {
  const provider = getProviderFromModel(modelId)
  const apiKey = apiKeyOverride || (await getProviderApiKey(provider))

  if (!apiKey) {
    throw new Error(
      `API key não configurada para ${provider}. Configure em Configurações > IA.`
    )
  }

  let model: LanguageModel

  // Fetch Helicone config from database
  const heliconeConfig = await getHeliconeConfig()
  const heliconeEnabled = heliconeConfig !== null

  // Build Helicone headers if enabled (per-provider)
  const buildHeliconeHeaders = (prov: AIProvider) => {
    if (!heliconeConfig) return undefined
    const gateway = HELICONE_GATEWAYS[prov]
    return {
      'Helicone-Auth': `Bearer ${heliconeConfig.apiKey}`,
      ...(gateway.targetURL && { 'Helicone-Target-URL': gateway.targetURL }),
    }
  }

  switch (provider) {
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
      const heliconeHeaders = buildHeliconeHeaders('google')
      const google = createGoogleGenerativeAI({
        apiKey,
        ...(heliconeEnabled && {
          baseURL: HELICONE_GATEWAYS.google.baseURL,
          headers: heliconeHeaders,
        }),
      })
      model = google(modelId)
      if (heliconeEnabled) {
        console.log(`[provider-factory] Helicone proxy enabled for Google`)
      }
      break
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      const heliconeHeaders = buildHeliconeHeaders('openai')
      const openai = createOpenAI({
        apiKey,
        ...(heliconeEnabled && {
          baseURL: HELICONE_GATEWAYS.openai.baseURL,
          headers: heliconeHeaders,
        }),
      })
      model = openai(modelId)
      if (heliconeEnabled) {
        console.log(`[provider-factory] Helicone proxy enabled for OpenAI`)
      }
      break
    }
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      const heliconeHeaders = buildHeliconeHeaders('anthropic')
      const anthropic = createAnthropic({
        apiKey,
        ...(heliconeEnabled && {
          baseURL: HELICONE_GATEWAYS.anthropic.baseURL,
          headers: heliconeHeaders,
        }),
      })
      model = anthropic(modelId)
      if (heliconeEnabled) {
        console.log(`[provider-factory] Helicone proxy enabled for Anthropic`)
      }
      break
    }
    default:
      throw new Error(`Provider não suportado: ${provider}`)
  }

  return { model, provider, apiKey }
}

/**
 * Verifica se um modelo é suportado.
 */
export function isSupportedModel(modelId: string): boolean {
  return (
    modelId.startsWith('gemini') ||
    modelId.startsWith('gpt') ||
    modelId.startsWith('claude')
  )
}
