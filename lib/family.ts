import { localizeSupabaseError } from './api-error';
import { supabase } from './supabase';

export type Family = {
  nome: string;
};

export async function getFamily(
  familyId: string,
): Promise<{ data: Family | null; error: string | null }> {
  const { data, error } = await supabase
    .from('familias')
    .select('nome')
    .eq('id', familyId)
    .single();

  if (error) return { data: null, error: localizeSupabaseError(error.message) };
  return { data, error: null };
}
