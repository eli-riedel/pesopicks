import { localBackend } from './local'
import { createSupabaseBackend } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

export const api = url && key ? createSupabaseBackend(url, key) : localBackend
