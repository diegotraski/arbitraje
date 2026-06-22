import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Cliente público (lecturas desde el navegador, respeta RLS)
export const supabasePublic = createClient(supabaseUrl, anonKey);

// Cliente con privilegios de servidor (solo usar en rutas /api, nunca en el cliente)
export const supabaseAdmin = createClient(supabaseUrl, serviceKey || anonKey, {
  auth: { persistSession: false },
});
