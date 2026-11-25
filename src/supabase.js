import { createClient } from '@supabase/supabase-js'

// Las claves salen del archivo .env.local (nunca las escribas directo aquí)
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anonKey)
