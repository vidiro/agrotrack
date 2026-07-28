import { createClient } from '@supabase/supabase-js'

// Credenciales de Supabase (incrustadas para funcionar en Vercel)
const SUPABASE_URL = 'https://iylvecwpyiytyfuvirfh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bHZlY3dweWl5dHlmdXZpcmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NzE0NDYsImV4cCI6MjEwMDU0NzQ0Nn0.np2zCuJEGsj1zbtlhYfVAtPbTambUfHq6c36C8PBkR0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
