import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleRequest } from './handler.ts';

// Re-export types and functions for backward compatibility
export type {
  PushEvent,
  EventPayload,
  NotificationPrefs,
  PushNotificationRequest,
  PushNotificationResponse,
  ExpoPushMessage,
  ExpoTicketResult,
} from './handler.ts';

export {
  validateRequest,
  buildMessage,
  getPreferenceKey,
  resolveRecipientUserIds,
  isPreferenceEnabled,
  resolveTokens,
  sendToExpoPushApi,
  processTicketResults,
  handleRequest,
} from './handler.ts';

Deno.serve((req: Request) =>
  handleRequest(req, {
    getServiceRoleKey: () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    getSupabaseUrl: () => Deno.env.get('SUPABASE_URL')!,
    createSupabaseClient: (url, key) => createClient(url, key),
  }),
);
