const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { createSupabaseClient } = require('../lib/supabaseClient');

const router = express.Router();

/**
 * POST /auth/signup
 * Creates a user in Supabase Auth using the SDK.
 */
router.post('/auth/signup', async (req, res) => {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client is not configured' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ user: data.user });
});

/**
 * POST /auth/login
 * Authenticates a user via Supabase's password sign-in.
 */
router.post('/auth/login', async (req, res) => {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client is not configured' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  return res.status(200).json({
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token
  });
});

/**
 * POST /auth/logout
 * Protected route that logs the current user out via Supabase.
 */
router.post('/auth/logout', requireAuth, async (req, res) => {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client is not configured' });
  }

  const authHeader = req.get('authorization') || '';
  const [, token] = authHeader.trim().split(' ');

  // Set the session context so Supabase knows which token to revoke
  await supabase.auth.setSession({ access_token: token, refresh_token: '' });
  const { error } = await supabase.auth.signOut();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(204).send();
});

/**
 * GET /public/info
 * Public endpoint that does not require authentication.
 */
router.get('/public/info', (req, res) => {
  res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

/**
 * GET /protected/profile
 * Protected endpoint that returns a safe subset of the user's profile.
 */
router.get('/protected/profile', requireAuth, (req, res) => {
  const user = req.user || {};

  res.status(200).json({
    id: user.id,
    email: user.email,
    created_at: user.created_at
  });
});

module.exports = router;
