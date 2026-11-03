(function () {
  const loginScreen = document.getElementById("loginScreen");
  const appShell = document.getElementById("appShell");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const loginSubmit = document.getElementById("loginSubmit");
  const accountLabel = document.getElementById("accountLabel");
  const logoutButton = document.getElementById("logoutButton");

  function showError(message) {
    loginError.textContent = message;
    loginError.style.display = "block";
  }

  function showLogin() {
    loginScreen.hidden = false;
    appShell.hidden = true;
    accountLabel.textContent = "Signed out";
    logoutButton.hidden = true;
  }

  async function showApp(session) {
    const client = window.supabaseClient;
    const { data: profile, error } = await client
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", session.user.id)
      .single();

    if (error || !profile || !profile.is_active) {
      await client.auth.signOut();
      showLogin();
      showError(
        "Your profile could not be loaded. Check that your Supabase profile exists and that its access policy allows you to read your own profile. " +
        (error?.message || "")
      );
      return;
    }

    if (!["employer", "employee"].includes(profile.role)) {
      await client.auth.signOut();
      showLogin();
      showError("Your account does not have a valid role.");
      return;
    }

    window.currentProfile = { ...profile, email: session.user.email };

    try {
      await window.employeeAdmin.load();
    } catch (loadError) {
      await client.auth.signOut();
      showLogin();
      showError("Could not load employee profiles. Apply the latest database migration first. " + (loadError?.message || ""));
      return;
    }

    if (profile.role === "employee") {
      data.currentUser = session.user.id;
      selectedEmployee = session.user.id;
    } else {
      selectedEmployee = data.employees[0]?.id || "";
    }

    accountLabel.textContent =
      (profile.full_name || session.user.email) +
      (profile.role === "employer" ? " · Employer" : " · Employee");

    loginScreen.hidden = true;
    appShell.hidden = false;
    logoutButton.hidden = false;
    page = "dashboard";
    render();
  }

  async function start() {
    if (!window.supabaseClient) {
      showLogin();
      showError("Supabase did not initialize. Check config/supabase.js and assets/js/supabase-client.js.");
      return;
    }

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      loginError.style.display = "none";
      loginSubmit.disabled = true;
      loginSubmit.textContent = "Signing in…";

      try {
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const { data: result, error } = await window.supabaseClient.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          showError(error.message);
          return;
        }

        await showApp(result.session);
      } catch (error) {
        showError(error?.message || "An unexpected sign-in error occurred.");
      } finally {
        loginSubmit.disabled = false;
        loginSubmit.textContent = "Sign in";
      }
    });

    logoutButton.addEventListener("click", async () => {
      const { error } = await window.supabaseClient.auth.signOut();
      if (error) {
        showError(error.message);
        return;
      }
      window.currentProfile = null;
      showLogin();
    });

    const { data: sessionData, error } = await window.supabaseClient.auth.getSession();
    if (error) {
      showLogin();
      showError(error.message);
      return;
    }

    if (sessionData.session) {
      await showApp(sessionData.session);
    } else {
      showLogin();
    }
  }

  start();
})();
