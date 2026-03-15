import { supabase } from './supabase';

export type Family = {
  nome: string;
};

export async function getFamily(familyId: string): Promise<Family | null> {
  const { data, error } = await supabase
    .from('familias')
    .select('nome')
    .eq('id', familyId)
    .single();

  if (error || !data) return null;
  return data as Family;
}
