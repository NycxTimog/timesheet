(function () {
  const config = window.SUPABASE_CONFIG;

  if (!config || !config.url || !config.publishableKey) {
    console.error("Supabase configuration is missing.");
    return;
  }

  if (!window.supabase) {
    console.error("Supabase library failed to load.");
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    config.url,
    config.publishableKey
  );

  console.log("Supabase client initialized successfully.");
})();
