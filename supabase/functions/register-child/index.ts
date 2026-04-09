import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleRequest } from './handler.ts';

export type { RegisterChildRequest, RegisterChildResponse } from './handler.ts';

export { validateRequest, handleRequest } from './handler.ts';

Deno.serve((req: Request) =>
  handleRequest(req, {
    getServiceRoleKey: () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    getSupabaseUrl: () => Deno.env.get('SUPABASE_URL')!,
    createSupabaseClient: (url, key) => createClient(url, key),
  }),
);
