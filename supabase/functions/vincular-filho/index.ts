import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleRequest } from './handler.ts';

export type {
  VincularFilhoRequest,
  VincularFilhoResponse,
  VincularFilhoSuccessResponse,
  VincularFilhoErrorResponse,
} from './handler.ts';

export { validateRequest, handleRequest } from './handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return handleRequest(req, {
    getServiceRoleKey: () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    getSupabaseUrl: () => Deno.env.get('SUPABASE_URL')!,
    createSupabaseClient: (url, key) => createClient(url, key),
  });
});
