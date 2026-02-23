import { NextResponse } from 'next/server';
import { checkUpstreamUpdates, mergeUpstream } from '@/lib/installer/github';

/**
 * GET /api/settings/updates
 * Verifica se há atualizações disponíveis do upstream
 */
export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const repoFullName = process.env.GITHUB_REPO_FULL_NAME;

  if (!token || !repoFullName) {
    return NextResponse.json(
      { ok: false, error: 'Configuração GitHub não encontrada. Reinstale o sistema para habilitar atualizações automáticas.' },
      { status: 400 }
    );
  }

  const [owner, repo] = repoFullName.split('/');

  if (!owner || !repo) {
    return NextResponse.json(
      { ok: false, error: 'Nome do repositório inválido' },
      { status: 400 }
    );
  }

  const result = await checkUpstreamUpdates({ token, owner, repo });

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    behindBy: result.status.behindBy,
    commits: result.status.commits,
  });
}

/**
 * POST /api/settings/updates
 * Aplica as atualizações do upstream no fork
 */
export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  const repoFullName = process.env.GITHUB_REPO_FULL_NAME;

  if (!token || !repoFullName) {
    return NextResponse.json(
      { ok: false, error: 'Configuração GitHub não encontrada. Reinstale o sistema para habilitar atualizações automáticas.' },
      { status: 400 }
    );
  }

  const [owner, repo] = repoFullName.split('/');

  if (!owner || !repo) {
    return NextResponse.json(
      { ok: false, error: 'Nome do repositório inválido' },
      { status: 400 }
    );
  }

  const result = await mergeUpstream({ token, owner, repo });

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
  });
}
