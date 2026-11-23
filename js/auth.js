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
    if (headerActions && !document.getElementById("profileMenu")) {
      const user = session.user;
      const metadata = user.user_metadata || {};
      const avatarUrl = metadata.avatar_url || metadata.picture || "";
      const displayName = metadata.full_name || metadata.name || user.email || "User";
      const profileMenu = document.createElement("div");
      profileMenu.className = "profile-menu";
      profileMenu.id = "profileMenu";

      const trigger = document.createElement("button");
      trigger.className = "profile-trigger";
      trigger.type = "button";
      trigger.setAttribute("aria-label", "Open account menu");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-haspopup", "true");
      if (avatarUrl) {
        const avatar = document.createElement("img");
        avatar.src = avatarUrl;
        avatar.alt = "";
        avatar.referrerPolicy = "no-referrer";
        avatar.onerror = () => { trigger.textContent = (displayName.trim()[0] || "U").toUpperCase(); };
        trigger.appendChild(avatar);
      } else {
        trigger.textContent = (displayName.trim()[0] || "U").toUpperCase();
      }

      const dropdown = document.createElement("div");
      dropdown.className = "profile-dropdown";
      dropdown.innerHTML = '<div class="profile-email"></div><a href="account.html" data-en="Manage account" data-ar="إدارة الحساب">Manage account</a><button type="button" id="menuSignOut" data-en="Sign out" data-ar="تسجيل الخروج">Sign out</button>';
      dropdown.querySelector(".profile-email").textContent = user.email || displayName;
      const pageLang = document.documentElement.lang === "ar" ? "ar" : "en";
      dropdown.querySelectorAll("[data-en][data-ar]").forEach((item) => {
        item.textContent = item.dataset[pageLang];
      });
      profileMenu.append(trigger, dropdown);
      headerActions.appendChild(profileMenu);

      const closeMenu = () => {
        profileMenu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      };
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = profileMenu.classList.toggle("open");
        trigger.setAttribute("aria-expanded", String(isOpen));
      });
      document.addEventListener("click", (event) => {
        if (!profileMenu.contains(event.target)) closeMenu();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
      });
      dropdown.querySelector("#menuSignOut").addEventListener("click", async () => {
        const signOut = dropdown.querySelector("#menuSignOut");
        signOut.disabled = true;
        const { error: signOutError } = await client.auth.signOut();
        if (signOutError) {
          signOut.disabled = false;
          alert("تعذر تسجيل الخروج: " + signOutError.message);
        } else {
          window.location.replace(LOGIN_URL);
        }
      });
    }

    const accountForm = document.getElementById("accountForm");
    if (accountForm) {
      const nameField = document.getElementById("accountName");
      const emailField = document.getElementById("accountEmail");
      if (emailField) emailField.value = session.user.email || "";
      const accountStatus = document.getElementById("accountStatus");
      const metadata = session.user.user_metadata || {};
      nameField.value = metadata.full_name || metadata.name || "";
      accountForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const saveButton = accountForm.querySelector('button[type="submit"]');
        saveButton.disabled = true;
        accountStatus.textContent = "جاري حفظ التغييرات...";
        const { error: updateError } = await client.auth.updateUser({
          data: { full_name: nameField.value.trim() }
        });
        saveButton.disabled = false;
        accountStatus.textContent = updateError ? "تعذر حفظ التغييرات: " + updateError.message : "تم تحديث بيانات الحساب بنجاح.";
      });
    }

    client.auth.onAuthStateChange((event, updatedSession) => {
      if (event === "SIGNED_OUT" || !updatedSession) window.location.replace(LOGIN_URL);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();