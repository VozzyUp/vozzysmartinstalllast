import { NextResponse } from 'next/server'
import { settingsDb } from '@/lib/supabase-db'

const SETTING_KEY = 'permanent_token_confirmed'

/**
 * GET /api/settings/onboarding
 * Retorna o status da confirmação do token permanente
 */
export async function GET() {
  try {
    const value = await settingsDb.get(SETTING_KEY)

    return NextResponse.json({
      permanentTokenConfirmed: value === 'true',
    })
  } catch (error) {
    console.error('Erro ao buscar settings de onboarding:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configurações' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/onboarding
 * Salva a confirmação do token permanente
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { permanentTokenConfirmed } = body

    if (typeof permanentTokenConfirmed !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo permanentTokenConfirmed deve ser boolean' },
        { status: 400 }
      )
    }

    await settingsDb.set(SETTING_KEY, permanentTokenConfirmed ? 'true' : 'false')

    return NextResponse.json({
      success: true,
      permanentTokenConfirmed,
    })
  } catch (error) {
    console.error('Erro ao salvar settings de onboarding:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar configurações' },
      { status: 500 }
    )
  }
}
