import { createServerClient } from './supabase';

type ActorType = 'respondent' | 'admin' | 'system';

/**
 * Logs an audit event to the audit_logs table.
 * PRD §8.1.8 — non-fatal; failures are console-logged only.
 */
export async function logEvent(
    actorType: ActorType,
    actorId: string | null,
    eventType: string,
    entityType: string,
    entityId?: string | null,
    payload?: Record<string, unknown>
) {
    try {
        const supabase = createServerClient();
        await supabase.from('audit_logs').insert({
            actor_type: actorType,
            actor_id: actorId,
            event_type: eventType,
            entity_type: entityType,
            entity_id: entityId ?? null,
            payload_json: payload ?? null,
        });
    } catch {
        console.error('[audit] Failed to log event', { eventType, entityType });
    }
}
