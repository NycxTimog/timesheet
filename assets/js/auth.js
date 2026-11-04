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
  function showDuplicateEmailPopup() {
    let modal = document.getElementById('duplicateEmailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'duplicateEmailModal';
      modal.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="duplicateEmailTitle" style="width:min(440px,calc(100% - 36px));background:#fff;border:1px solid #dbe4f0;border-radius:22px;padding:30px;box-shadow:0 24px 80px rgba(15,35,65,.24);text-align:center;font-family:inherit">
          <div style="width:58px;height:58px;margin:0 auto 16px;border-radius:50%;background:#fff4df;color:#b7791f;display:grid;place-items:center;font-size:28px">!</div>
          <h2 id="duplicateEmailTitle" style="margin:0 0 10px;color:#142d50;font-size:24px">Email Already Registered</h2>
          <p style="margin:0 0 24px;color:#64748b;line-height:1.55">This email address already has an account. Please sign in or use a different email address.</p>
          <button type="button" id="duplicateEmailSignIn" style="width:100%;border:0;border-radius:12px;padding:14px 18px;background:#1976d2;color:#fff;font-weight:700;font-size:16px;cursor:pointer">Go to Sign In</button>
          <button type="button" id="duplicateEmailClose" style="margin-top:12px;border:0;background:transparent;color:#64748b;font-weight:600;padding:10px 18px;cursor:pointer">Close</button>
        </div>`;
      Object.assign(modal.style, {
        position: 'fixed', inset: '0', zIndex: '99999', display: 'none',
        alignItems: 'center', justifyContent: 'center', padding: '18px',
        background: 'rgba(15, 23, 42, .58)'
      });
      document.body.appendChild(modal);
      modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.id === 'duplicateEmailClose') modal.style.display = 'none';
        if (event.target.id === 'duplicateEmailSignIn') {
          modal.style.display = 'none';
          showSignIn();
          document.getElementById('loginEmail').focus();
        }
      });
    }
    modal.style.display = 'flex';
  }

  async function getFunctionErrorMessage(error) {
    const context = error?.context;
    if (context && typeof context.clone === 'function') {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
        if (body?.message) return String(body.message);
      } catch (_) {}
    }
    return error?.message || 'Registration request failed.';
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
          if (error) {
            const detail = await getFunctionErrorMessage(error);
            if (/already been registered|already registered|user already exists|email.*already/i.test(detail)) {
              showDuplicateEmailPopup();
              return;
            }
            throw new Error(detail);
          }
          if (data?.error) {
            if (/already been registered|already registered|user already exists|email.*already/i.test(data.error)) {
              showDuplicateEmailPopup();
              return;
            }
            throw new Error(data.error);
          }
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
