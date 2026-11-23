document.addEventListener("DOMContentLoaded", () => {
  // Load Supabase and the shared auth guard on every protected page.
  const supabaseScript = document.createElement("script");
  supabaseScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  supabaseScript.onload = () => {
    const configScript = document.createElement("script");
    configScript.src = "js/supabase-config.js";
    configScript.onload = () => {
      const authScript = document.createElement("script");
      authScript.src = "js/auth.js";
      document.body.appendChild(authScript);
    };
    document.body.appendChild(configScript);
  };
  supabaseScript.onerror = () => {
    document.documentElement.style.visibility = "visible";
    console.error("Could not load Supabase JS");
  };
  document.head.appendChild(supabaseScript);


  // Gentle reveal animations as sections enter the viewport.
  const motionTargets = document.querySelectorAll(
    ".hero .eyebrow, .hero h1, .hero p, .hero-buttons, .stat, .section-header, .card, .step, .highlight-box, .form-card, .contact-item, .cta"
  );
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    motionTargets.forEach((element) => element.classList.add("reveal"));
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    motionTargets.forEach((element) => revealObserver.observe(element));
  }

  const langBtn = document.getElementById("langBtn");
  const menuBtn = document.getElementById("menuBtn");
  const nav = document.getElementById("nav");
  // Persistent light/dark appearance control.
  const themeButton = document.createElement("button");
  themeButton.type = "button";
  themeButton.className = "theme-toggle";
  themeButton.id = "themeToggle";
  themeButton.setAttribute("aria-label", "Switch color theme");
  themeButton.title = "Switch color theme";
  const savedTheme = localStorage.getItem("marco-theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;
  function syncThemeButton() {
    const light = document.documentElement.dataset.theme === "light";
    themeButton.textContent = light ? "☾" : "☀";
    themeButton.title = light ? "Switch to dark mode" : "Switch to light mode";
    themeButton.setAttribute("aria-label", themeButton.title);
  }
  const headerActions = document.querySelector(".site-header .header-actions");
  if (headerActions) {
    headerActions.insertBefore(themeButton, headerActions.firstChild);
    syncThemeButton();
    themeButton.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem("marco-theme", nextTheme);
      syncThemeButton();
    });
  }

  let currentLang = localStorage.getItem("marco-language") || "en";

  function changeLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (document.body) document.body.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en][data-ar]").forEach((element) => {
      element.textContent = lang === "ar" ? element.dataset.ar : element.dataset.en;
    });
    if (langBtn) langBtn.textContent = lang === "ar" ? "English" : "العربية";
    localStorage.setItem("marco-language", lang);
  }

  if (langBtn) langBtn.addEventListener("click", () => changeLanguage(currentLang === "en" ? "ar" : "en"));
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => nav.classList.toggle("active"));
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => nav.classList.remove("active")));
  }

  const bookingForm = document.getElementById("bookingForm");
  if (bookingForm) {
    bookingForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(bookingForm);
      const name = formData.get("name");
      const email = formData.get("email");
      const phone = formData.get("phone");
      const session = formData.get("session");
      const date = formData.get("date");
      const slotLabel = formData.get("slot_label");
      const details = formData.get("details");
      const message = currentLang === "ar"
        ? `طلب حجز جلسة جديدة\n\nالموعد المختار: ${slotLabel || "لم يتم اختيار موعد"}\nالاسم: ${name}\nالبريد: ${email}\nالهاتف: ${phone}\nنوع الجلسة: ${session}\nالتاريخ المفضل: ${date}\nالتفاصيل: ${details}`
        : `New Booking Request\n\nSelected appointment: ${slotLabel || "No appointment selected"}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nSession: ${session}\nPreferred Date: ${date}\nDetails: ${details}`;
      if (!formData.get("slot_id")) { alert(currentLang === "ar" ? "من فضلك اختار موعدًا متاحًا أولًا." : "Please select an available appointment first."); return; }
      const whatsappNumber = "201000000000";
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
    });
  }
  changeLanguage(currentLang);
});