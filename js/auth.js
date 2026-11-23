(() => {
  const LOGIN_PATH = "login.html";
  const BASE_PATH = "/marco-live-coash-academy/";
  const isLogin = location.pathname.endsWith("/" + LOGIN_PATH);
  const loginUrl = new URL(LOGIN_PATH, location.href).href;
  const homeUrl = new URL("index.html", location.href).href;

  if (!isLogin) document.documentElement.style.visibility = "hidden";

  async function start() {
    if (!window.supabase || !window.MARCO_SUPABASE_URL || !window.MARCO_SUPABASE_PUBLISHABLE_KEY) {
      document.documentElement.style.visibility = "visible";
      const status = document.getElementById("authStatus");
      if (status) status.textContent = "تعذر تحميل خدمة تسجيل الدخول. حدّث الصفحة وحاول مرة أخرى.";
      return;
    }

    const client = window.supabase.createClient(
      window.MARCO_SUPABASE_URL,
      window.MARCO_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
    window.marcoSupabase = client;

    const { data: { session }, error } = await client.auth.getSession();
    if (error) console.error("Session check:", error);

    if (isLogin) {
      if (session) {
        location.replace(homeUrl);
        return;
      }
      document.documentElement.style.visibility = "visible";
      const button = document.getElementById("googleLogin");
      const status = document.getElementById("authStatus");
      if (button) button.addEventListener("click", async () => {
        button.disabled = true;
        if (status) status.textContent = "جاري تحويلك إلى Google...";
        const redirectTo = new URL("index.html", location.href).href;
        const result = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo }
        });
        if (result.error) {
          button.disabled = false;
          if (status) status.textContent = "حدث خطأ: " + result.error.message;
        }
      });
      return;
    }

    if (!session) {
      const next = encodeURIComponent(location.href);
      location.replace(loginUrl + "?next=" + next);
      return;
    }

    document.documentElement.style.visibility = "visible";
    const headerActions = document.querySelector(".header-actions");
    if (headerActions && !document.getElementById("signOutBtn")) {
      const user = session.user;
      const email = document.createElement("span");
      email.className = "auth-user";
      email.textContent = user.email || "Signed in";
      email.title = user.email || "";
      headerActions.appendChild(email);

      const signOut = document.createElement("button");
      signOut.id = "signOutBtn";
      signOut.className = "lang-btn";
      signOut.type = "button";
      signOut.textContent = "تسجيل الخروج";
      signOut.addEventListener("click", async () => {
        signOut.disabled = true;
        const result = await client.auth.signOut();
        if (result.error) {
          signOut.disabled = false;
          alert("تعذر تسجيل الخروج: " + result.error.message);
        } else {
          location.replace(loginUrl);
        }
      });
      headerActions.appendChild(signOut);
    }

    client.auth.onAuthStateChange((event, updatedSession) => {
      if (event === "SIGNED_OUT" || !updatedSession) location.replace(loginUrl);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();