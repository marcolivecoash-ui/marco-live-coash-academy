(() => {
  const SITE_BASE = window.location.origin + "/marco-live-coash-academy/";
  const LOGIN_URL = SITE_BASE + "login.html";
  const HOME_URL = SITE_BASE + "index.html";
  const isLogin = window.location.pathname.endsWith("/login.html");

  if (!isLogin) document.documentElement.style.visibility = "hidden";

  async function start() {
    const status = document.getElementById("authStatus");
    if (!window.supabase || !window.MARCO_SUPABASE_URL || !window.MARCO_SUPABASE_PUBLISHABLE_KEY) {
      document.documentElement.style.visibility = "visible";
      if (status) status.textContent = "تعذر تحميل خدمة تسجيل الدخول. تأكد من الاتصال بالإنترنت ثم حدّث الصفحة.";
      return;
    }

    const client = window.supabase.createClient(
      window.MARCO_SUPABASE_URL,
      window.MARCO_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
    window.marcoSupabase = client;

    const { data, error } = await client.auth.getSession();
    if (error) console.error("Supabase session error:", error);
    const session = data && data.session;

    if (isLogin) {
      if (session) {
        window.location.replace(HOME_URL);
        return;
      }
      document.documentElement.style.visibility = "visible";

      const googleButton = document.getElementById("googleLogin");
      if (googleButton) googleButton.addEventListener("click", async () => {
        googleButton.disabled = true;
        if (status) status.textContent = "جاري فتح Google...";
        const { error: oauthError } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: HOME_URL }
        });
        if (oauthError) {
          googleButton.disabled = false;
          if (status) status.textContent = "تعذر تسجيل الدخول بجوجل: " + oauthError.message;
        }
      });

      const form = document.getElementById("emailAuthForm");
      const submit = document.getElementById("emailSubmit");
      const loginTab = document.getElementById("showLogin");
      const signupTab = document.getElementById("showSignup");
      const password = document.getElementById("authPassword");
      let mode = "login";

      function setMode(nextMode) {
        mode = nextMode;
        loginTab.classList.toggle("active", mode === "login");
        signupTab.classList.toggle("active", mode === "signup");
        submit.textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
        password.autocomplete = mode === "login" ? "current-password" : "new-password";
        if (status) status.textContent = mode === "login" ? "أدخل بريدك الإلكتروني وكلمة المرور." : "أنشئ حسابك باستخدام بريد إلكتروني وكلمة مرور.";
      }
      loginTab.addEventListener("click", () => setMode("login"));
      signupTab.addEventListener("click", () => setMode("signup"));

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        const email = document.getElementById("authEmail").value.trim();
        const passwordValue = password.value;
        if (status) status.textContent = mode === "login" ? "جاري تسجيل الدخول..." : "جاري إنشاء الحساب...";
        let result;
        if (mode === "login") {
          result = await client.auth.signInWithPassword({ email, password: passwordValue });
        } else {
          result = await client.auth.signUp({
            email,
            password: passwordValue,
            options: { emailRedirectTo: HOME_URL }
          });
        }
        submit.disabled = false;
        if (result.error) {
          if (status) status.textContent = "تعذر إكمال العملية: " + result.error.message;
          return;
        }
        if (mode === "signup" && !result.data.session) {
          if (status) status.textContent = "تم إنشاء الحساب. افتح بريدك الإلكتروني واضغط رابط تأكيد الحساب، ثم ارجع وسجّل الدخول.";
          return;
        }
        if (status) status.textContent = "تم بنجاح. جاري فتح الموقع...";
        window.location.replace(HOME_URL);
      });
      return;
    }

    if (!session) {
      window.location.replace(LOGIN_URL + "?next=" + encodeURIComponent(window.location.href));
      return;
    }

    document.documentElement.style.visibility = "visible";
    const headerActions = document.querySelector(".header-actions");
    if (headerActions && !document.getElementById("signOutBtn")) {
      const email = document.createElement("span");
      email.className = "auth-user";
      email.textContent = session.user.email || "Signed in";
      email.title = session.user.email || "";
      headerActions.appendChild(email);

      const signOut = document.createElement("button");
      signOut.id = "signOutBtn";
      signOut.className = "lang-btn";
      signOut.type = "button";
      signOut.textContent = "تسجيل الخروج";
      signOut.addEventListener("click", async () => {
        signOut.disabled = true;
        const { error: signOutError } = await client.auth.signOut();
        if (signOutError) {
          signOut.disabled = false;
          alert("تعذر تسجيل الخروج: " + signOutError.message);
        } else {
          window.location.replace(LOGIN_URL);
        }
      });
      headerActions.appendChild(signOut);
    }

    client.auth.onAuthStateChange((event, updatedSession) => {
      if (event === "SIGNED_OUT" || !updatedSession) window.location.replace(LOGIN_URL);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();