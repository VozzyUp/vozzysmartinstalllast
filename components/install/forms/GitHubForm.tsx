'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Github, Loader2, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';
import type { FormProps } from './types';

const REPO_NAME_REGEX = /^[a-z0-9._-]+$/;
const REPO_NAME_ERRORS = {
  invalid: 'Use apenas letras minúsculas (a–z), números (0–9) e os caracteres . _ -',
  tooLong: 'O nome deve ter no máximo 100 caracteres',
  tripleDash: 'O nome não pode conter a sequência "---"',
};

export function GitHubForm({ data, onComplete, onBack, showBack }: FormProps) {
  const [githubToken, setGithubToken] = useState(data.githubToken || '');
  const [githubUsername, setGithubUsername] = useState(data.githubUsername || '');
  const [repoName, setRepoName] = useState(data.githubRepoName || '');

  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [repoNameError, setRepoNameError] = useState('');
  const [tokenValidated, setTokenValidated] = useState(!!data.githubToken);

  // Validação do token
  const handleValidateToken = useCallback(async () => {
    if (!githubToken.trim()) {
      setError('Digite um token GitHub');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const res = await fetch('/api/installer/github/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken }),
      });

      const result = await res.json();

      if (!res.ok || !result.ok) {
        setError(result.error || 'Token inválido');
        setTokenValidated(false);
        return;
      }

      setGithubUsername(result.user.login);
      setTokenValidated(true);
    } catch (err) {
      setError('Erro ao validar token');
      setTokenValidated(false);
    } finally {
      setIsValidating(false);
    }
  }, [githubToken]);

  const handleRepoNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setRepoName(value);

    if (!value) {
      setRepoNameError('');
    } else if (value.length >= 100) {
      setRepoNameError(REPO_NAME_ERRORS.tooLong);
    } else if (!REPO_NAME_REGEX.test(value)) {
      setRepoNameError(REPO_NAME_ERRORS.invalid);
    } else if (value.includes('---')) {
      setRepoNameError(REPO_NAME_ERRORS.tripleDash);
    } else {
      setRepoNameError('');
    }
  }, []);

  // Criação do fork
  const handleCreateRepo = useCallback(async () => {
    if (!repoName.trim()) {
      setError('Digite um nome para o repositório');
      return;
    }

    if (repoName.length >= 100 || !REPO_NAME_REGEX.test(repoName)) {
      setError(REPO_NAME_ERRORS.invalid);
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const res = await fetch('/api/installer/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          repoName: repoName.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.ok) {
        setError(result.error || 'Erro ao criar repositório');
        return;
      }

      // Sucesso! Passa os dados para o próximo step
      onComplete({
        githubToken,
        githubUsername,
        githubRepoName: result.repo.name,
        githubRepoUrl: result.repo.html_url,
        githubRepoFullName: result.repo.full_name,
      });
    } catch (err) {
      setError('Erro ao criar repositório');
    } finally {
      setIsCreating(false);
    }
  }, [githubToken, repoName, githubUsername, onComplete]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Conectar GitHub</h2>
        <p className="text-muted-foreground">
          Crie um fork do repositório VozzySmart
        </p>
      </div>

      {error && (
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Token de Acesso Pessoal (Obrigatório) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>1. Token de Acesso Pessoal</Label>
          {tokenValidated && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Conectado como @{githubUsername}
            </div>
          )}
        </div>

        <Alert>
          <Github className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Token GitHub (Obrigatório)</strong>
            <p className="mt-1 text-muted-foreground">
              O token é necessário para criar o fork e manter seu sistema atualizado automaticamente.
            </p>
            <ol className="mt-2 ml-4 space-y-1 text-muted-foreground list-decimal">
              <li>Acesse o link abaixo e faça login no GitHub</li>
              <li>Clique em &quot;Generate token&quot; no final da página</li>
              <li>Copie o token gerado (começa com ghp_)</li>
              <li>Cole o token no campo abaixo</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="githubToken">Token de Acesso Pessoal <span className="text-red-500">*</span></Label>
          <Input
            id="githubToken"
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            value={githubToken}
            onChange={(e) => {
              setGithubToken(e.target.value);
              if (tokenValidated) {
                setTokenValidated(false);
                setGithubUsername('');
              }
            }}
            disabled={isValidating}
          />
          {!tokenValidated && (
            <Button
              type="button"
              onClick={handleValidateToken}
              disabled={isValidating || !githubToken.trim()}
              variant="outline"
              className="w-full"
            >
              {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Validar Token
            </Button>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,user:email&description=VozzySmart%20Installer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Criar token no GitHub (abre em nova aba)
            </a>
          </p>
        </div>
      </div>

      {/* Step 2: Configurar Repositório */}
      {tokenValidated && (
        <div className="space-y-4">
          <Label>2. Configurar Repositório</Label>
          
          <div className="space-y-2">
            <Label htmlFor="repoName">Nome do Repositório</Label>
            <Input
              id="repoName"
              type="text"
              placeholder="meu-repositorio"
              value={repoName}
              onChange={handleRepoNameChange}
              disabled={isCreating}
            />
            {repoNameError && (
              <p className="text-xs text-red-500">{repoNameError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Será criado em: github.com/{githubUsername}/{repoName}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {showBack && (
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Voltar
          </Button>
        )}
        <Button
          type="button"
          onClick={handleCreateRepo}
          disabled={!tokenValidated || isCreating || !repoName.trim() || !!repoNameError}
          className="flex-1"
        >
          {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isCreating ? 'Criando Fork...' : 'Criar Fork e Continuar'}
        </Button>
      </div>
    </div>
  );
}
