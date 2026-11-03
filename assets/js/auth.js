(function () {
  const loginScreen = document.getElementById('loginScreen');
  const appShell = document.getElementById('appShell');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginSubmit = document.getElementById('loginSubmit');
  const accountLabel = document.getElementById('accountLabel');
  const logoutButton = document.getElementById('logoutButton');

  function message(text, isError = true) {
    loginError.textContent = text;
    loginError.style.display = 'block';
    loginError.style.background = isError ? '#fff0f0' : '#edf9f1';
    loginError.style.color = isError ? '#a52e38' : '#176b43';
    loginError.style.borderColor = isError ? '#f0caca' : '#bfe5cc';
  }
  function showLogin() {
    loginScreen.hidden = false; appShell.hidden = true;
    accountLabel.textContent = 'Signed out'; logoutButton.hidden = true;
  }
  function showRegister() {
    document.getElementById('loginTitle').textContent = 'Create employee account';
    document.getElementById('loginIntro').textContent = 'Register as an employee to manage your own attendance.';
    document.getElementById('loginSubmit').textContent = 'Create account';
    document.getElementById('loginPassword').autocomplete = 'new-password';
    document.getElementById('registerNameWrap').hidden = false;
    document.getElementById('registerBack').hidden = false;
    document.getElementById('registerLink').hidden = true;
    loginForm.dataset.mode = 'register';
    loginError.style.display = 'none';
  }
  function showSignIn() {
    document.getElementById('loginTitle').textContent = 'Welcome back';
    document.getElementById('loginIntro').textContent = 'Sign in with your registered account to continue.';
    document.getElementById('loginSubmit').textContent = 'Sign in';
    document.getElementById('loginPassword').autocomplete = 'current-password';
    document.getElementById('registerNameWrap').hidden = true;
    document.getElementById('registerBack').hidden = true;
    document.getElementById('registerLink').hidden = false;
    loginForm.dataset.mode = 'login';
    loginError.style.display = 'none';
  }
  async function showApp(session) {
    const client = window.supabaseClient;
    const { data: profile, error } = await client.from('profiles')
      .select('id, full_name, role, is_active').eq('id', session.user.id).single();
    if (error || !profile || !profile.is_active) {
      await client.auth.signOut(); showLogin();
      message('Your profile could not be loaded or your account is inactive. ' + (error?.message || '')); return;
    }
    if (!['employer', 'employee'].includes(profile.role)) {
      await client.auth.signOut(); showLogin(); message('Your account does not have a valid role.'); return;
    }
    window.currentProfile = { ...profile, email: session.user.email };
    try { await window.employeeAdmin.load(); }
    catch (e) { await client.auth.signOut(); showLogin(); message('Could not load employee profiles: ' + (e?.message || '')); return; }
    if (profile.role === 'employee') { data.currentUser = session.user.id; selectedEmployee = session.user.id; }
    else selectedEmployee = data.employees[0]?.id || '';
    accountLabel.textContent = (profile.full_name || session.user.email) + (profile.role === 'employer' ? ' · Employer' : ' · Employee');
    loginScreen.hidden = true; appShell.hidden = false; logoutButton.hidden = false; page = 'dashboard'; render();
  }
  async function start() {
    if (!window.supabaseClient) { showLogin(); message('Supabase did not initialize. Check your configuration.'); return; }
    showSignIn();
    document.getElementById('registerLink').addEventListener('click', showRegister);
    document.getElementById('registerBack').addEventListener('click', showSignIn);
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault(); loginError.style.display = 'none'; loginSubmit.disabled = true;
      const mode = loginForm.dataset.mode || 'login';
      loginSubmit.textContent = mode === 'register' ? 'Creating account…' : 'Signing in…';
      try {
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;
        if (mode === 'register') {
          const full_name = document.getElementById('registerFullName').value.trim();
          if (full_name.length < 2) throw new Error('Please enter your full name.');
          if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
          const { data, error } = await window.supabaseClient.functions.invoke('employee-register', { body: { full_name, email, password } });
          if (error) throw new Error(error.message || 'Registration request failed.');
          if (data?.error) throw new Error(data.error);
          showSignIn();
          document.getElementById('loginEmail').value = email;
          document.getElementById('loginPassword').value = '';
          message('Employee account created. You can now sign in with your email and password.', false);
        } else {
          const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
          if (error) throw error;
          await showApp(data.session);
        }
      } catch (e) { message(e?.message || 'Something went wrong.'); }
      finally { loginSubmit.disabled = false; loginSubmit.textContent = mode === 'register' ? 'Create account' : 'Sign in'; }
    });
    logoutButton.addEventListener('click', async () => { const { error } = await window.supabaseClient.auth.signOut(); if (error) { message(error.message); return; } window.currentProfile = null; showLogin(); showSignIn(); });
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) { showLogin(); message(error.message); return; }
    if (data.session) await showApp(data.session); else showLogin();
  }
  start();
})();
