import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; // Assure-toi que cette variable d'environnement est définie
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Assure-toi que cette variable d'environnement est définie

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
