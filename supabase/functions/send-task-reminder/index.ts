import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleRequest } from './handler.ts';

// Re-export types and functions for backward compatibility
export type {
  SendTaskReminderRequest,
  SendTaskReminderResponse,
  HandlerDeps,
} from './handler.ts';

export {
  constantTimeEquals,
  validateRequest,
  resolveChildUserId,
  buildReminderMessage,
  handleRequest,
} from './handler.ts';

Deno.serve((req: Request) =>
  handleRequest(req, {
    getServiceRoleKey: () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    getSupabaseUrl: () => Deno.env.get('SUPABASE_URL') ?? '',
    createSupabaseClient: (url, key) => createClient(url, key),
    reportDiagnostic: (diagnostic) => {
      const payload = JSON.stringify(diagnostic);
      if (diagnostic.level === 'error') {
        console.error(payload);
      } else if (diagnostic.level === 'warn') {
        console.warn(payload);
      } else {
        console.info(payload);
      }
    },
  }),
);
