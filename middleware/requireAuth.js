const { createSupabaseClient } = require('../lib/supabaseClient');

/**
 * Reusable auth guard for protected routes.
 * It validates the Authorization header, checks the token with Supabase,
 * and attaches the verified user data to req.user.
 */
function requireAuth(req, res, next) {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client is not configured' });
  }

  const authHeader = req.get('authorization') || '';
  const headerValue = authHeader.trim();

  if (!headerValue) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const [scheme, token] = headerValue.split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  return supabase.auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data?.user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      req.user = data.user;
      return next();
    })
    .catch(() => {
      return res.status(401).json({ error: 'Invalid or expired token' });
    });
}

module.exports = requireAuth;
