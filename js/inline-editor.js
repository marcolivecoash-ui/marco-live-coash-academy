(() => {
  const start = async () => {
    const client = window.marcoSupabase;
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;
    const { data: isEditor, error: roleError } = await client.rpc("is_marco_editor");
    if (roleError || isEditor !== true) return;
    const page = (location.pathname.split("/").pop() || "index.html").replace(".html", "").replace(/[^a-z0-9_-]/gi, "") || "home";
    const pageKey = page === "index" ? "home" : page;
    const { data: rows, error } = await client.from("site_content").select("content_key,content_type,value_ar,value_en");
    if (error) { console.warn("Inline editor content load:", error.message); return; }
    const content = new Map((rows || []).map(row => [row.content_key, row]));
    const lang = () => document.documentElement.lang === "ar" ? "ar" : "en";
    document.querySelectorAll("[data-content-key]").forEach(el => {
      const item = content.get(el.dataset.contentKey); if (!item) return;
      const value = lang() === "ar" ? (item.value_ar || item.value_en) : (item.value_en || item.value_ar);
      if (!value) return;
      if (item.content_type === "image") { if (el.tagName === "IMG") el.src = value; else el.style.backgroundImage = 'url("' + value.replace(/["\\]/g, "") + '")'; }
      else el.textContent = value;
    });
    const style = document.createElement("style");
    style.textContent = '#marco-edit-toggle{position:fixed;z-index:99990;bottom:22px;inset-inline-end:22px;border:1px solid rgba(255,255,255,.35);border-radius:16px;padding:13px 18px;background:linear-gradient(135deg,#1677ff,#28d9ff);color:#fff;font:700 14px system-ui;box-shadow:0 10px 35px #1677ff55;cursor:pointer}.marco-edit-target{outline:1px dashed transparent!important;outline-offset:4px}.marco-editing .marco-edit-target{outline-color:rgba(40,217,255,.8)!important}.marco-edit-pen{display:none;position:absolute;z-index:9998;inset-inline-end:5px;top:5px;width:31px;height:31px;border:1px solid #ffffff66;border-radius:10px;background:rgba(15,35,60,.92);color:#fff;cursor:pointer;font-size:16px}.marco-editing .marco-edit-pen{display:block}#marco-edit-panel{position:fixed;z-index:100000;inset-inline-end:20px;bottom:82px;width:min(390px,calc(100vw - 40px));max-height:75vh;overflow:auto;padding:18px;border:1px solid #ffffff38;border-radius:20px;background:rgba(13,25,44,.96);color:#fff;box-shadow:0 20px 70px #0009;backdrop-filter:blur(24px);font:14px/1.6 system-ui}#marco-edit-panel[hidden]{display:none}#marco-edit-panel h3{margin:0 0 12px;font-size:18px;color:#fff}#marco-edit-panel label{display:block;margin:10px 0 5px;color:#cfeaff}#marco-edit-panel textarea,#marco-edit-panel input{box-sizing:border-box;width:100%;padding:10px;border:1px solid #ffffff30;border-radius:10px;background:#071426;color:#fff;font:inherit}#marco-edit-panel textarea{min-height:76px;resize:vertical}#marco-edit-panel .marco-edit-actions{display:flex;gap:8px;margin-top:12px}#marco-edit-panel button{border:0;border-radius:10px;padding:10px 13px;font:700 13px system-ui;cursor:pointer}#marco-edit-save{background:#1685ff;color:white}#marco-edit-cancel{background:#ffffff20;color:white}#marco-edit-status{min-height:20px;margin-top:8px;color:#83e8ff}html[data-theme="light"] #marco-edit-panel{background:rgba(245,250,255,.97);color:#142238}html[data-theme="light"] #marco-edit-panel h3,html[data-theme="light"] #marco-edit-panel label{color:#18344f}html[data-theme="light"] #marco-edit-panel textarea,html[data-theme="light"] #marco-edit-panel input{background:#fff;color:#142238;border-color:#b6cbdc}';
    document.head.appendChild(style);
    const toggle = document.createElement("button"); toggle.id = "marco-edit-toggle"; toggle.type = "button"; toggle.textContent = "✏️ تحرير الصفحة"; document.body.appendChild(toggle);
    const panel = document.createElement("section"); panel.id = "marco-edit-panel"; panel.hidden = true;
    panel.innerHTML = '<h3>تعديل محتوى الصفحة</h3><label for="marco-edit-ar">النص بالعربي</label><textarea id="marco-edit-ar"></textarea><label for="marco-edit-en">Text in English</label><textarea id="marco-edit-en"></textarea><label for="marco-edit-image">رابط الصورة (اختياري)</label><input id="marco-edit-image" type="url" placeholder="https://..."><div class="marco-edit-actions"><button id="marco-edit-save" type="button">حفظ التغييرات</button><button id="marco-edit-cancel" type="button">إلغاء</button></div><div id="marco-edit-status" role="status"></div>';
    document.body.appendChild(panel);
    const candidates = [...document.querySelectorAll("main h1,main h2,main h3,main p,main li,main .eyebrow,main .card-icon,main img,main .highlight-box,main .cta")].filter(el => !el.closest("form") && !el.matches("button,input,textarea,select") && (el.tagName === "IMG" || el.children.length === 0 || el.matches(".highlight-box,.cta")));
    const counters = {};
    candidates.forEach(el => {
      const kind = el.tagName.toLowerCase(); counters[kind] = (counters[kind] || 0) + 1;
      if (!el.dataset.contentKey) el.dataset.contentKey = "inline." + pageKey + "." + kind + "." + counters[kind];
      el.classList.add("marco-edit-target"); if (getComputedStyle(el).position === "static") el.style.position = "relative";
      const pen = document.createElement("button"); pen.type = "button"; pen.className = "marco-edit-pen"; pen.textContent = "✎"; pen.title = "تعديل هذا العنصر"; pen.setAttribute("aria-label", "تعديل هذا العنصر");
      pen.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); openEditor(el); }); el.appendChild(pen);
    });
    let active = null;
    function openEditor(el) {
      active = el; const item = content.get(el.dataset.contentKey) || {};
      document.getElementById("marco-edit-ar").value = item.value_ar || el.dataset.ar || (el.tagName === "IMG" ? "" : el.textContent.replace("✎","").trim());
      document.getElementById("marco-edit-en").value = item.value_en || el.dataset.en || (el.tagName === "IMG" ? "" : el.textContent.replace("✎","").trim());
      document.getElementById("marco-edit-image").value = item.content_type === "image" ? (item.value_en || item.value_ar || "") : (el.tagName === "IMG" ? el.src : "");
      document.getElementById("marco-edit-status").textContent = ""; panel.hidden = false; document.getElementById("marco-edit-ar").focus();
    }
    toggle.addEventListener("click", () => { const enabled = document.body.classList.toggle("marco-editing"); toggle.textContent = enabled ? "✓ إنهاء التحرير" : "✏️ تحرير الصفحة"; if (!enabled) panel.hidden = true; });
    document.getElementById("marco-edit-cancel").addEventListener("click", () => { panel.hidden = true; active = null; });
    document.getElementById("marco-edit-save").addEventListener("click", async () => {
      if (!active) return;
      const save = document.getElementById("marco-edit-save"), status = document.getElementById("marco-edit-status"), imageUrl = document.getElementById("marco-edit-image").value.trim();
      const isImage = active.tagName === "IMG" || imageUrl.length > 0;
      const valueAr = isImage ? imageUrl : document.getElementById("marco-edit-ar").value.trim();
      const valueEn = isImage ? imageUrl : document.getElementById("marco-edit-en").value.trim();
      if (!valueAr && !valueEn) { status.textContent = "اكتب محتوى قبل الحفظ."; return; }
      save.disabled = true; status.textContent = "جاري الحفظ...";
      const payload = {content_key:active.dataset.contentKey,page:pageKey,content_type:isImage?"image":"text",value_ar:valueAr,value_en:valueEn,updated_at:new Date().toISOString(),updated_by:sessionData.session.user.id};
      const {error:saveError} = await client.from("site_content").upsert(payload,{onConflict:"content_key"}); save.disabled = false;
      if (saveError) { status.textContent = "تعذر الحفظ: " + saveError.message; return; }
      content.set(payload.content_key,payload);
      if (isImage) { if (active.tagName === "IMG") active.src = valueEn || valueAr; else active.style.backgroundImage = 'url("' + (valueEn || valueAr).replace(/["\\]/g,"") + '")'; }
      else {
        const value = lang() === "ar" ? (valueAr || valueEn) : (valueEn || valueAr);
        active.childNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE) node.textContent = ""; });
        active.insertBefore(document.createTextNode(value), active.querySelector(".marco-edit-pen"));
        active.dataset.ar = valueAr; active.dataset.en = valueEn;
      }
      status.textContent = "تم الحفظ بنجاح.";
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 900)); else setTimeout(start, 900);
})();