/**
 * Crea y expone el cliente de Supabase como window.novaDb.
 * Requiere que el CDN de supabase-js y supabase-config.js se carguen antes.
 */
(function () {
  'use strict';

  var config = window.NOVAFIT_SUPABASE || {};

  function isPlaceholder(value, token) {
    return !value || String(value).indexOf(token) !== -1;
  }

  window.NOVAFIT_CONFIGURED =
    !isPlaceholder(config.url, 'TU-PROYECTO') &&
    !isPlaceholder(config.anonKey, 'TU-ANON-KEY');

  window.novaDb = null;

  if (!window.NOVAFIT_CONFIGURED) {
    console.warn('[NovaFit] Supabase sin configurar. Edita frontend/js/supabase-config.js');
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[NovaFit] No se pudo cargar el SDK de Supabase desde el CDN.');
    window.NOVAFIT_CONFIGURED = false;
    return;
  }

  window.novaDb = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // URL base de la carpeta frontend/, usada para los enlaces de confirmacion.
  window.NOVAFIT_BASE_URL = new URL('.', window.location.href).href;
})();
