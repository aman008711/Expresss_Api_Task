const { createClient } = require('@supabase/supabase-js');

function normalizeSupabaseUrl(url) {
  if (!url) {
    return '';
  }

  const trimmedUrl = url.trim();

  const dashboardMatch = trimmedUrl.match(/\/dashboard\/project\/([^/]+)/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  return trimmedUrl;
}

/**
 * Build a Supabase client from environment variables.
 * The anon key is the only key this learning app should use.
 */
function createSupabaseClient() {
  const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

module.exports = {
  createSupabaseClient
};
