import "server-only";

import { Client as QStashClient } from "@upstash/qstash";
import { getSupabaseAdmin } from "@/lib/supabase";

const NGROK_API = 'http://127.0.0.1:4040/api'

async function getNgrokPublicUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${NGROK_API}/tunnels`, { method: 'GET' })
    if (!res.ok) return null
    const data = (await res.json()) as { tunnels?: Array<{ public_url?: string; proto?: string }> }
    const tunnels = Array.isArray(data?.tunnels) ? data.tunnels : []
    const https = tunnels.find((t) => String(t?.proto || '').toLowerCase() === 'https' && t.public_url)
    if (https?.public_url) return https.public_url
    const any = tunnels.find((t) => t.public_url)
    return any?.public_url ? String(any.public_url) : null
  } catch {
    return null
  }
}

type ScheduleConfig = {
  workflowId: string;
  cron: string;
  timezone?: string | null;
  secret?: string | null;
};

export async function syncWorkflowSchedule(config: ScheduleConfig) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  if (!process.env.QSTASH_TOKEN) {
    throw new Error("QSTASH_TOKEN not configured");
  }

  const { data: workflow } = await supabase
    .from("workflows")
    .select("schedule_qstash_message_id")
    .eq("id", config.workflowId)
    .maybeSingle<{ schedule_qstash_message_id: string | null }>();

  const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN });

  if (workflow?.schedule_qstash_message_id) {
    try {
      await qstash.messages.delete(workflow.schedule_qstash_message_id);
    } catch {
      // best-effort cleanup
    }
  }

  const isDev = process.env.NODE_ENV === 'development'
  const devNgrokUrl = isDev ? await getNgrokPublicUrl() : null
  const baseUrl = devNgrokUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const schedule = await qstash.publishJSON({
    url: `${baseUrl}/api/builder/workflow/${config.workflowId}/execute`,
    body: {
      workflowId: config.workflowId,
      input: { trigger: "schedule" },
    },
    cron: config.cron,
    headers: config.secret ? { "x-workflow-secret": config.secret } : undefined,
    retries: 3,
    ...(config.timezone ? { timezone: config.timezone } : {}),
  });

  await supabase
    .from("workflows")
    .update({
      schedule_cron: config.cron,
      schedule_timezone: config.timezone ?? null,
      schedule_qstash_message_id: schedule.messageId,
      schedule_active: true,
      schedule_updated_at: new Date().toISOString(),
    })
    .eq("id", config.workflowId);

  return schedule.messageId;
}

export async function clearWorkflowSchedule(workflowId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return;
  }

  const { data: workflow } = await supabase
    .from("workflows")
    .select("schedule_qstash_message_id")
    .eq("id", workflowId)
    .maybeSingle<{ schedule_qstash_message_id: string | null }>();

  if (workflow?.schedule_qstash_message_id && process.env.QSTASH_TOKEN) {
    try {
      const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN });
      await qstash.messages.delete(workflow.schedule_qstash_message_id);
    } catch {
      // ignore
    }
  }

  await supabase
    .from("workflows")
    .update({
      schedule_cron: null,
      schedule_timezone: null,
      schedule_qstash_message_id: null,
      schedule_active: false,
      schedule_updated_at: new Date().toISOString(),
    })
    .eq("id", workflowId);
}
