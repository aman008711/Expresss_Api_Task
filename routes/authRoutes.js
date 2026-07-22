const express = require('express');
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

module.exports = router;
