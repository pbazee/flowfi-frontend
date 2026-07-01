const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logger');

let supabase;
let supabaseAdmin;

function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    throw new Error('Missing Supabase credentials in environment variables');
  }

  // Regular client (respects RLS)
  supabase = createClient(url, anonKey);

  // Admin client (bypasses RLS — use only server-side for admin ops)
  supabaseAdmin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  logger.info('✅ Supabase connected');
  return { supabase, supabaseAdmin };
}

function getSupabase() {
  if (!supabase) throw new Error('Supabase not initialized. Call initSupabase() first.');
  return supabase;
}

function getSupabaseAdmin() {
  if (!supabaseAdmin) throw new Error('Supabase admin not initialized. Call initSupabase() first.');
  return supabaseAdmin;
}

module.exports = { initSupabase, getSupabase, getSupabaseAdmin };
