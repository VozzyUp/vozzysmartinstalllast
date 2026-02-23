'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  ExternalLink,
  GitBranch,
} from 'lucide-react';

interface Commit {
  sha: string;
  message: string;
  date: string;
}

export function UpdatePanel() {
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [behindBy, setBehindBy] = useState<number | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleCheckUpdates = async () => {
    setIsChecking(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/settings/updates');
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || 'Erro ao verificar atualizações');
        setBehindBy(null);
        return;
      }

      setBehindBy(data.behindBy);
      setCommits(data.commits || []);

      if (data.behindBy === 0) {
        setSuccessMessage('Sistema atualizado! Nenhuma atualização disponível.');
      }
    } catch {
      setError('Erro de conexão ao verificar atualizações');
    } finally {
      setIsChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/settings/updates', { method: 'POST' });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || 'Erro ao aplicar atualizações');
        return;
      }

      setSuccessMessage(data.message);
      setBehindBy(0);
      setCommits([]);
    } catch {
      setError('Erro de conexão ao aplicar atualizações');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20">
            <GitBranch className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Atualizações do Sistema</h3>
            <p className="text-sm text-muted-foreground">
              Mantenha seu VozzySmart sempre atualizado
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckUpdates}
          disabled={isChecking || isUpdating}
        >
          {isChecking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isChecking ? 'Verificando...' : 'Verificar'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success */}
      {successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-600 dark:text-green-400">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Updates available */}
      {behindBy !== null && behindBy > 0 && !successMessage && (
        <div className="space-y-3">
          <Alert>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription>
              <strong className="text-amber-600 dark:text-amber-400">
                {behindBy} {behindBy === 1 ? 'atualização disponível' : 'atualizações disponíveis'}
              </strong>
            </AlertDescription>
          </Alert>

          {/* Commit list */}
          {commits.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Novidades incluídas:
              </p>
              <ul className="space-y-1.5">
                {commits.map((commit) => (
                  <li key={commit.sha} className="text-sm flex items-start gap-2">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                      {commit.sha}
                    </code>
                    <span className="text-muted-foreground truncate flex-1">
                      {commit.message}
                    </span>
                    <span className="text-xs text-muted-foreground/60 shrink-0">
                      {formatDate(commit.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="flex-1"
            >
              {isUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isUpdating ? 'Atualizando...' : 'Atualizar Agora'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Após a atualização, o Vercel fará redeploy automaticamente.
          </p>
        </div>
      )}

      {/* No updates checked yet */}
      {behindBy === null && !error && !successMessage && (
        <p className="text-sm text-muted-foreground">
          Clique em &quot;Verificar&quot; para buscar atualizações disponíveis.
        </p>
      )}
    </div>
  );
}
