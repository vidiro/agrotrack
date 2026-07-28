import { createClient } from '@supabase/supabase-js'

// Reemplaza estos valores con los de tu proyecto Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://TU_PROYECTO.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'TU_CLAVE_ANON'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
