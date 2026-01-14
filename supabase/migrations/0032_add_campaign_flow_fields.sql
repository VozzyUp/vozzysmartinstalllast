-- =============================================================================
-- Campaigns: adicionar campos de Flow para métricas de submissão
-- =============================================================================

-- flow_id: referência ao Flow/MiniApp usado na campanha (se houver)
-- flow_name: nome do Flow para exibição (desnormalizado para performance)
ALTER TABLE IF EXISTS public.campaigns
  ADD COLUMN IF NOT EXISTS flow_id TEXT,
  ADD COLUMN IF NOT EXISTS flow_name TEXT;

-- Index para queries de submissões por campanha
CREATE INDEX IF NOT EXISTS idx_campaigns_flow_id ON public.campaigns (flow_id)
  WHERE flow_id IS NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.campaigns.flow_id IS 'ID do Flow/MiniApp usado na campanha (meta_flow_id)';
COMMENT ON COLUMN public.campaigns.flow_name IS 'Nome do Flow para exibição';

NOTIFY pgrst, 'reload schema';
