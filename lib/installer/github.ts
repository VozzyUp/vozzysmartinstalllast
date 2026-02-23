/**
 * Integração com GitHub API para o installer.
 * Gerencia autenticação OAuth, criação de repositórios e configuração de secrets.
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeUTF8 } from 'tweetnacl-util';

const GITHUB_API_BASE = 'https://api.github.com';
const TEMPLATE_OWNER = 'VozzyUp';
const TEMPLATE_REPO = 'vozzysmart_template';

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  private: boolean;
}

/**
 * Valida um token GitHub e retorna informações do usuário
 */
export async function validateGitHubToken(
  token: string
): Promise<{ ok: true; user: GitHubUser } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, error: 'Token GitHub inválido ou expirado' };
      }
      const errorText = await res.text();
      return { ok: false, error: `Erro ao validar token: ${errorText}` };
    }

    const user = (await res.json()) as GitHubUser;
    return { ok: true, user };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao validar token GitHub';
    return { ok: false, error: message };
  }
}

/**
 * Cria um fork do repositório VozzySmart
 * Usa a API de forks do GitHub para manter vínculo com o upstream
 */
export async function forkRepo(params: {
  token: string;
  newRepoName: string;
}): Promise<{ ok: true; repo: GitHubRepo } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}/forks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: params.newRepoName,
          default_branch_only: true,
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const message = (errorData as { message?: string }).message || 'Erro ao criar fork';

      if (res.status === 422) {
        return { ok: false, error: 'Nome de repositório já existe ou é inválido' };
      }

      return { ok: false, error: message };
    }

    const repo = (await res.json()) as GitHubRepo;
    return { ok: true, repo };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar fork';
    return { ok: false, error: message };
  }
}

// =============================================================================
// UPDATE / SYNC UPSTREAM
// =============================================================================

export interface UpstreamStatus {
  behindBy: number;
  commits: { sha: string; message: string; date: string }[];
}

/**
 * Verifica se o fork está atrás do upstream (VozzyUp/vozzySmart).
 * Compara a branch main do fork com a do upstream.
 */
export async function checkUpstreamUpdates(params: {
  token: string;
  owner: string;
  repo: string;
}): Promise<{ ok: true; status: UpstreamStatus } | { ok: false; error: string }> {
  try {
    // Compara upstream main com o fork main
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/compare/main...${TEMPLATE_OWNER}:${TEMPLATE_REPO}:main`,
      {
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: (errorData as { message?: string }).message || 'Erro ao verificar atualizações',
      };
    }

    const data = (await res.json()) as {
      ahead_by: number;
      commits: { sha: string; commit: { message: string; author: { date: string } } }[];
    };

    return {
      ok: true,
      status: {
        behindBy: data.ahead_by, // upstream is "ahead" = fork is "behind"
        commits: data.commits.slice(0, 20).map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0],
          date: c.commit.author.date,
        })),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao verificar atualizações';
    return { ok: false, error: message };
  }
}

/**
 * Sincroniza o fork com o upstream usando a API merge-upstream do GitHub.
 * Faz merge das atualizações do VozzyUp/vozzySmart na branch main do fork.
 */
export async function mergeUpstream(params: {
  token: string;
  owner: string;
  repo: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/merge-upstream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ branch: 'main' }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = (errorData as { message?: string }).message || '';

      if (res.status === 409) {
        return { ok: false, error: 'Conflito de merge detectado. Resolva manualmente no GitHub.' };
      }

      return { ok: false, error: msg || 'Erro ao aplicar atualizações' };
    }

    const data = (await res.json()) as { merge_type?: string; message?: string };

    if (data.merge_type === 'none') {
      return { ok: true, message: 'Já está atualizado. Nenhuma alteração necessária.' };
    }

    return { ok: true, message: 'Atualização aplicada com sucesso! O Vercel fará redeploy automaticamente.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao aplicar atualizações';
    return { ok: false, error: message };
  }
}

/**
 * Obtém a chave pública do repositório para criptografar secrets
 */
async function getRepoPublicKey(params: {
  token: string;
  owner: string;
  repo: string;
}): Promise<{ ok: true; keyId: string; key: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/actions/secrets/public-key`,
      {
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!res.ok) {
      return { ok: false, error: 'Erro ao obter chave pública do repositório' };
    }

    const data = (await res.json()) as { key_id: string; key: string };
    return { ok: true, keyId: data.key_id, key: data.key };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao obter chave pública';
    return { ok: false, error: message };
  }
}

/**
 * Criptografa um valor usando a chave pública do repositório
 * Usa libsodium (tweetnacl) para criptografia
 */
function encryptSecret(publicKey: string, secretValue: string): string {
  // Converte a chave pública de base64
  const keyBytes = Buffer.from(publicKey, 'base64');
  
  // Converte o valor do secret para bytes
  const messageBytes = decodeUTF8(secretValue);
  
  // Criptografa usando sealed box (anonymous encryption)
  // Note: tweetnacl doesn't have box.seal, so we use a simple approach
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ephemeralKeyPair = nacl.box.keyPair();
  
  const encrypted = nacl.box(
    messageBytes,
    nonce,
    keyBytes.subarray(0, nacl.box.publicKeyLength),
    ephemeralKeyPair.secretKey
  );
  
  // Combina ephemeral public key + nonce + encrypted
  const combined = new Uint8Array(
    ephemeralKeyPair.publicKey.length + nonce.length + encrypted.length
  );
  combined.set(ephemeralKeyPair.publicKey);
  combined.set(nonce, ephemeralKeyPair.publicKey.length);
  combined.set(encrypted, ephemeralKeyPair.publicKey.length + nonce.length);
  
  // Retorna em base64
  return encodeBase64(combined);
}

/**
 * Adiciona ou atualiza um secret no repositório GitHub
 */
async function upsertRepoSecret(params: {
  token: string;
  owner: string;
  repo: string;
  secretName: string;
  secretValue: string;
  keyId: string;
  publicKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Criptografa o valor
    const encryptedValue = await encryptSecret(params.publicKey, params.secretValue);

    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/actions/secrets/${params.secretName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encrypted_value: encryptedValue,
          key_id: params.keyId,
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `Erro ao configurar secret ${params.secretName}: ${errorText}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao configurar secret';
    return { ok: false, error: message };
  }
}

/**
 * Adiciona múltiplos secrets ao repositório GitHub
 */
export async function addRepoSecrets(params: {
  token: string;
  owner: string;
  repo: string;
  secrets: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Obtém a chave pública do repositório
    const keyResult = await getRepoPublicKey({
      token: params.token,
      owner: params.owner,
      repo: params.repo,
    });

    if (!keyResult.ok) {
      return { ok: false, error: keyResult.error };
    }

    // Adiciona cada secret
    for (const [secretName, secretValue] of Object.entries(params.secrets)) {
      const result = await upsertRepoSecret({
        token: params.token,
        owner: params.owner,
        repo: params.repo,
        secretName,
        secretValue,
        keyId: keyResult.keyId,
        publicKey: keyResult.key,
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao adicionar secrets';
    return { ok: false, error: message };
  }
}

/**
 * Verifica se um repositório existe
 */
export async function checkRepoExists(params: {
  token: string;
  owner: string;
  repo: string;
}): Promise<{ exists: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}`,
      {
        headers: {
          Authorization: `Bearer ${params.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    return { exists: res.ok };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao verificar repositório';
    return { exists: false, error: message };
  }
}
