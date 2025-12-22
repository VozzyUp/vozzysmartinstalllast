'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTemplatesController } from '@/hooks/useTemplates';
import { TemplateListView } from '@/components/features/templates/TemplateListView';
import { useManualDraftsController } from '@/hooks/useManualDrafts';
import { ManualDraftsView } from '@/components/features/templates/ManualDraftsView';
import { useTemplateProjectsQuery, useTemplateProjectMutations } from '@/hooks/useTemplateProjects';
import { Loader2, Plus, Folder, Search, RefreshCw, CheckCircle, AlertTriangle, Trash2, LayoutGrid, Sparkles, Zap, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Page, PageActions, PageDescription, PageHeader, PageTitle } from '@/components/ui/page';
import { Button } from '@/components/ui/button';

import { FlowSubmissionsView } from '@/components/features/flows/FlowSubmissionsView'
import { FlowPublishPanel } from '@/components/features/flows/FlowPublishPanel'
import { FlowTestPanel } from '@/components/features/flows/FlowTestPanel'
import { useFlowSubmissionsController } from '@/hooks/useFlowSubmissions'
import { flowsService } from '@/services/flowsService'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

// Status Badge Component
const StatusBadge = ({ status, approvedCount, totalCount }: { status: string; approvedCount?: number; totalCount?: number }) => {
  const isDraft = status === 'draft';
  const isComplete = approvedCount && totalCount && approvedCount === totalCount && totalCount > 0;
  const isPartial = approvedCount && approvedCount > 0 && !isComplete;

  if (isComplete) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        Concluído
      </span>
    );
  }
  if (isPartial) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
        <span className="relative flex h-2 w-2 mr-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
        Em Progresso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
      Rascunho
    </span>
  );
};

const AIFeatureWarningBanner = () => (
  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start sm:items-center gap-3">
    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
    <div className="min-w-0">
      <p className="text-amber-200 font-medium text-sm">
        Funcionalidade em desenvolvimento
      </p>
      <p className="text-amber-300/70 text-sm mt-0.5">
        Criação de templates com I.A ainda não está funcionando. Aguarde um pouco mais.
      </p>
    </div>
  </div>
);

export default function TemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const controller = useTemplatesController();
  const draftsController = useManualDraftsController();
  const { data: projects, isLoading: isLoadingProjects, refetch } = useTemplateProjectsQuery();
  const { deleteProject } = useTemplateProjectMutations();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'projects' | 'meta' | 'drafts' | 'flows'>('meta');
  const [selectedTestFlowId, setSelectedTestFlowId] = React.useState('');
  const [isCreatingFlow, setIsCreatingFlow] = React.useState(false);

  // Flows hub state
  const flowSubmissionsController = useFlowSubmissionsController()
  const flowsQuery = useQuery({
    queryKey: ['flows'],
    queryFn: flowsService.list,
    staleTime: 10_000,
    enabled: activeTab === 'flows',
  })
  const builderFlows = flowsQuery.data || []
  const flowsWithMetaId = builderFlows.filter((f) => !!f.meta_flow_id)
  const flowStage = builderFlows.length === 0 ? 'create' : flowsWithMetaId.length === 0 ? 'publish' : 'test'

  const scrollToId = React.useCallback((id: string) => {
    if (typeof document === 'undefined') return
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleQuickCreateFlow = async () => {
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const name = `flow_${stamp}`
    try {
      setIsCreatingFlow(true)
      const created = await flowsService.create({ name })
      router.push(`/flows/builder/${encodeURIComponent(created.id)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar flow')
    } finally {
      setIsCreatingFlow(false)
    }
  }

  // Deep-link: /templates?tab=flows
  React.useEffect(() => {
    const tab = (searchParams?.get('tab') || '').toLowerCase()
    if (tab === 'meta' || tab === 'drafts' || tab === 'projects' || tab === 'flows') {
      setActiveTab((prev) => ((prev as any) === tab ? prev : (tab as any)))
    }
  }, [searchParams])

  const setTab = (tab: 'projects' | 'meta' | 'drafts' | 'flows') => {
    setActiveTab(tab)
    router.replace(`/templates?tab=${encodeURIComponent(tab)}`)
  }

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteProject(id);
  };

  const filteredProjects = React.useMemo(() => {
    if (!projects) return [];
    if (!searchTerm) return projects;
    return projects.filter(p =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  return (
    <Page>
      {/* Aviso (topo): fica acima do título */}
      {activeTab === 'projects' && <AIFeatureWarningBanner />}

      <PageHeader>
        <div>
          <PageTitle>Templates</PageTitle>
          <PageDescription>
            {activeTab === 'flows'
              ? 'Crie e monitore WhatsApp Flows, e mapeie respostas para campos do SmartZap.'
              : 'Gerencie templates da Meta e rascunhos manuais.'}
          </PageDescription>
        </div>
        <PageActions>
          {activeTab === 'meta' && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => controller.setIsBulkModalOpen(true)}
                className="bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 transition-opacity shadow-lg shadow-emerald-900/20"
              >
                <Zap className="w-4 h-4 text-yellow-300" />
                Gerar UTILITY em Massa
              </Button>

              <Button
                onClick={() => controller.setIsAiModalOpen(true)}
                className="bg-linear-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 transition-opacity shadow-lg shadow-purple-900/20"
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
                Criar com IA
              </Button>

              <Button
                variant="outline"
                onClick={controller.onSync}
                disabled={controller.isSyncing}
                className="border-white/10 bg-zinc-900 hover:bg-white/5"
              >
                <RefreshCw className={cn('w-4 h-4', controller.isSyncing ? 'animate-spin' : '')} />
                {controller.isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            </div>
          )}

          {activeTab === 'projects' && (
            <button
              onClick={() => router.push('/templates/new')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/20"
            >
              <Plus className="w-5 h-5" />
              Novo Projeto
            </button>
          )}

          {activeTab === 'flows' && (
            <div className="flex items-center gap-2">
              {flowStage === 'test' && (
                <Button
                  variant="secondary"
                  onClick={() => scrollToId('flow-test-panel')}
                >
                  Testar envio
                </Button>
              )}
            </div>
          )}
        </PageActions>
      </PageHeader>

      {/* TABS */}
      <div className="flex gap-1 bg-zinc-900 border border-white/5 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('meta')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'meta'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
        >
          <CheckCircle className="w-4 h-4" />
          Meta (Templates)
        </button>

        <button
          onClick={() => setTab('drafts')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'drafts'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Rascunhos Manuais
        </button>

        <button
          onClick={() => setTab('flows')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'flows'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
        >
          <Workflow className="w-4 h-4" />
          Flows
        </button>

        <button
          onClick={() => setTab('projects')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'projects'
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Projetos (Fábrica)
        </button>
      </div>

      {activeTab === 'meta' && (
        <TemplateListView {...controller} hideHeader />
      )}

      {activeTab === 'drafts' && (
        <ManualDraftsView
          drafts={draftsController.drafts}
          isLoading={draftsController.isLoading}
          isRefreshing={draftsController.isRefreshing}
          search={draftsController.search}
          setSearch={draftsController.setSearch}
          onRefresh={draftsController.refresh}
          onCreate={({ name, category, language, parameterFormat }) =>
            draftsController.createDraft({ name, category, language, parameterFormat })
          }
          isCreating={draftsController.isCreating}
          onDelete={(id) => draftsController.deleteDraft(id)}
          isDeleting={draftsController.isDeleting}
          onUpdate={(id, patch) => draftsController.updateDraft(id, patch)}
          isUpdating={draftsController.isUpdating}
          onSubmit={(id) => draftsController.submitDraft(id)}
          isSubmitting={draftsController.isSubmitting}
          normalizeName={draftsController.normalizeTemplateName}
        />
      )}

      {activeTab === 'flows' && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start">
            <div className="space-y-4">
              <div className="glass-panel p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-400">Etapas</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span className={flowStage === 'create' ? 'text-white font-semibold' : ''}>1. Criar</span>
                    <span className="opacity-40">→</span>
                    <span className={flowStage === 'publish' ? 'text-white font-semibold' : ''}>2. Gerar Flow ID</span>
                    <span className="opacity-40">→</span>
                    <span className={flowStage === 'test' ? 'text-white font-semibold' : ''}>3. Testar no WhatsApp</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleQuickCreateFlow} disabled={isCreatingFlow}>
                    {isCreatingFlow ? 'Criando…' : 'Criar flow'}
                  </Button>
                </div>
              </div>
              {flowStage === 'publish' && (
                <div id="flow-publish-panel">
                  <FlowPublishPanel
                    flows={builderFlows}
                    isLoading={flowsQuery.isLoading}
                    isFetching={flowsQuery.isFetching}
                    onRefresh={() => flowsQuery.refetch()}
                    onSelectTestFlowId={(metaFlowId) => {
                      setSelectedTestFlowId(metaFlowId)
                      scrollToId('flow-test-panel')
                    }}
                  />
                </div>
              )}

              {flowStage === 'test' && (
                <FlowTestPanel
                  flows={builderFlows}
                  isLoadingFlows={flowsQuery.isFetching}
                  onRefreshFlows={() => flowsQuery.refetch()}
                  prefillFlowId={selectedTestFlowId}
                />
              )}
            </div>

            {flowStage === 'test' && (
              <div className="space-y-4">
                <FlowSubmissionsView
                  submissions={flowSubmissionsController.submissions}
                  isLoading={flowSubmissionsController.isLoading}
                  isFetching={flowSubmissionsController.isFetching}
                  phoneFilter={flowSubmissionsController.phoneFilter}
                  onPhoneFilterChange={flowSubmissionsController.setPhoneFilter}
                  flowIdFilter={flowSubmissionsController.flowIdFilter}
                  onFlowIdFilterChange={flowSubmissionsController.setFlowIdFilter}
                  onRefresh={() => flowSubmissionsController.refetch()}
                  builderFlows={builderFlows}
                  title="Últimos testes"
                  subtitle="Veja as submissões mais recentes. Expanda para detalhes."
                  showFilters={false}
                  limit={5}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <>
          {/* Filters Bar */}
          <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-96 bg-zinc-900 border border-white/5 rounded-lg px-4 py-2.5 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/50 transition-all">
              <Search size={18} className="text-gray-500" />
              <input
                type="text"
                placeholder="Buscar projetos..."
                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-colors"
                title="Atualizar"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 border-b border-white/5 text-gray-400 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">Nome</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-center">Templates</th>
                    <th className="px-6 py-4 font-medium">Progresso</th>
                    <th className="px-6 py-4 font-medium">Criado em</th>
                    <th className="px-6 py-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoadingProjects ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
                      </td>
                    </tr>
                  ) : filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Nenhum projeto encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => {
                      const approvedPercent = project.template_count > 0
                        ? Math.round((project.approved_count / project.template_count) * 100)
                        : 0;

                      return (
                        <tr
                          key={project.id}
                          onClick={() => router.push(`/templates/${project.id}`)}
                          className="hover:bg-white/5 transition-colors group cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                <Folder size={16} />
                              </div>
                              <div>
                                <p className="font-medium text-white group-hover:text-primary-400 transition-colors">
                                  {project.title}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge
                              status={project.status}
                              approvedCount={project.approved_count}
                              totalCount={project.template_count}
                            />
                          </td>
                          <td className="px-6 py-4 text-center text-gray-400 font-mono">
                            {project.template_count}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 w-24 bg-zinc-800 rounded-full h-1">
                                <div
                                  className="bg-emerald-500 h-1 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                  style={{ width: `${approvedPercent}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 font-mono w-10">
                                {approvedPercent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                            {new Date(project.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => handleDeleteProject(e, project.id)}
                                title="Excluir"
                                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
