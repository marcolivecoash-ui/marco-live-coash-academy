(() => {
  const start = async () => {
    const client = window.marcoSupabase;
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;
    const { data: isEditor, error: roleError } = await client.rpc("is_marco_editor");
    if (roleError || isEditor !== true) return;

    const pageName = (location.pathname.split("/").pop() || "index.html").replace(".html", "");
    const pageKey = pageName === "index" ? "home" : pageName;
    const { data: rows, error } = await client.from("site_content")
      .select("content_key,content_type,value_ar,value_en").eq("page", pageKey);
    if (error) { console.warn("Editor load:", error.message); return; }
    const saved = new Map((rows || []).map(row => [row.content_key, row]));
    const lang = () => document.documentElement.lang === "ar" ? "ar" : "en";

    // Apply previously saved content to this page before entering edit mode.
    document.querySelectorAll("[data-content-key]").forEach(el => {
      const item = saved.get(el.dataset.contentKey);
      if (!item) return;
      if (item.content_type === "image" && el.tagName === "IMG") el.src = item.value_en || item.value_ar;
      else if (item.content_type === "text") {
        el.dataset.ar = item.value_ar || "";
        el.dataset.en = item.value_en || "";
        el.textContent = lang() === "ar" ? (item.value_ar || item.value_en || "") : (item.value_en || item.value_ar || "");
      }
    });

    const css = document.createElement("style");
    css.textContent = `
      #marco-edit-bar{position:fixed;z-index:99999;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:9px;align-items:center;padding:10px 14px;border:1px solid #ffffff45;border-radius:18px;background:rgba(9,22,42,.94);backdrop-filter:blur(20px);box-shadow:0 12px 40px #0007;color:white;font:600 14px system-ui}
      #marco-edit-bar button{border:0;border-radius:11px;padding:11px 16px;font:700 14px system-ui;cursor:pointer}
      #marco-edit-start{background:linear-gradient(120deg,#1677ff,#24c9ef);color:white}
      #marco-edit-save{background:#16a36a;color:white;display:none}
      #marco-edit-cancel{background:#ffffff20;color:white;display:none}
      .marco-inline-editing [data-marco-editable="true"]{outline:1px dashed #26cfff!important;outline-offset:4px;cursor:text}
      .marco-inline-editing img[data-marco-image="true"]{cursor:pointer;outline:2px dashed #26cfff!important}
      #marco-edit-status{font-size:12px;color:#9ceaff;max-width:180px}
    `;
    document.head.appendChild(css);

    const bar = document.createElement("div");
    bar.id = "marco-edit-bar";
    bar.innerHTML = '<button id="marco-edit-start">✏️ تحرير الصفحة</button><button id="marco-edit-save">حفظ التعديلات</button><button id="marco-edit-cancel">إلغاء</button><span id="marco-edit-status"></span>';
    document.body.appendChild(bar);

    const main = document.querySelector("main");
    if (!main) return;
    const editable = [...main.querySelectorAll("h1,h2,h3,h4,p,li,span,strong,em,.eyebrow,.card-icon,img")]
      .filter(el => !el.closest("form,button") && (el.tagName === "IMG" || el.children.length === 0));
    const counts = {};
    editable.forEach(el => {
      const type = el.tagName.toLowerCase();
      counts[type] = (counts[type] || 0) + 1;
      if (!el.dataset.contentKey) el.dataset.contentKey = "inline." + pageKey + "." + type + "." + counts[type];
      if (el.tagName === "IMG") el.dataset.marcoImage = "true";
      else el.dataset.marcoEditable = "true";
    });

    let active = false;
    const originals = new Map();
    const startBtn = document.getElementById("marco-edit-start");
    const saveBtn = document.getElementById("marco-edit-save");
    const cancelBtn = document.getElementById("marco-edit-cancel");
    const status = document.getElementById("marco-edit-status");

    function enterEdit() {
      active = true;
      originals.clear();
      editable.forEach(el => {
        originals.set(el, { html: el.innerHTML, src: el.tagName === "IMG" ? el.src : "" });
        if (el.tagName !== "IMG") el.contentEditable = "true";
      });
      document.body.classList.add("marco-inline-editing");
      startBtn.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";
      status.textContent = "اضغط على النص واكتب مباشرة. اضغط على الصورة لتغييرها.";
    }
    function leaveEdit(restore) {
      if (restore) originals.forEach((value, el) => {
        el.innerHTML = value.html;
        if (el.tagName === "IMG") el.src = value.src;
      });
      editable.forEach(el => { el.contentEditable = "false"; });
      document.body.classList.remove("marco-inline-editing");
      active = false;
      startBtn.style.display = "inline-block";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";
      status.textContent = "";
    }
    startBtn.addEventListener("click", enterEdit);
    cancelBtn.addEventListener("click", () => leaveEdit(true));

    editable.filter(el => el.tagName === "IMG").forEach(img => {
      img.addEventListener("click", () => {
        if (!active) return;
        const url = prompt("حط رابط الصورة الجديدة:");
        if (url && /^https?:\/\//i.test(url)) img.src = url;
      });
    });

    saveBtn.addEventListener("click", async () => {
      if (!active) return;
      saveBtn.disabled = true;
      status.textContent = "جاري حفظ الصفحة...";
      const payloads = [];
      editable.forEach(el => {
        const key = el.dataset.contentKey;
        const previous = saved.get(key) || {};
        if (el.tagName === "IMG") {
          if (el.src !== (originals.get(el)?.src || el.src)) payloads.push({
            content_key:key,page:pageKey,content_type:"image",value_ar:el.src,value_en:el.src,
            updated_at:new Date().toISOString(),updated_by:sessionData.session.user.id
          });
        } else {
          const text = el.innerText.trim();
          const ar = lang() === "ar" ? text : (el.dataset.ar || previous.value_ar || text);
          const en = lang() === "en" ? text : (el.dataset.en || previous.value_en || text);
          const before = originals.get(el);
          if (before && text !== before.html.replace(/<[^>]*>/g,"").trim()) payloads.push({
            content_key:key,page:pageKey,content_type:"text",value_ar:ar,value_en:en,
            updated_at:new Date().toISOString(),updated_by:sessionData.session.user.id
          });
        }
      });
      if (!payloads.length) {
        saveBtn.disabled = false;
        status.textContent = "مفيش تغييرات جديدة للحفظ.";
        return;
      }
      const { error: saveError } = await client.from("site_content").upsert(payloads,{onConflict:"content_key"});
      saveBtn.disabled = false;
      if (saveError) { status.textContent = "فشل الحفظ: " + saveError.message; return; }
      payloads.forEach(item => saved.set(item.content_key,item));
      editable.forEach(el => {
        const item = saved.get(el.dataset.contentKey);
        if (item && item.content_type === "text") { el.dataset.ar=item.value_ar || ""; el.dataset.en=item.value_en || ""; }
      });
      leaveEdit(false);
      status.textContent = "تم حفظ تعديلات الصفحة بنجاح.";
      setTimeout(() => { status.textContent = ""; }, 4500);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 500));
  else setTimeout(start, 500);
})();