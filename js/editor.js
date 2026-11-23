(() => {
  const client = window.supabase.createClient(window.MARCO_SUPABASE_URL, window.MARCO_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });
  window.marcoSupabase = client;
  const $ = (id) => document.getElementById(id);
  const form = $("contentForm"), list = $("contentList"), status = $("editorStatus");
  let currentId = null;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const loginUrl = "login.html?next=" + encodeURIComponent(location.href);

  async function guard() {
    const { data:{session}, error } = await client.auth.getSession();
    if (error || !session) { location.replace(loginUrl); return false; }
    const { data:isEditor, error:roleError } = await client.rpc("is_marco_editor");
    if (roleError || isEditor !== true) {
      document.body.innerHTML = '<main style="max-width:650px;margin:15vh auto;padding:30px;text-align:center"><h1>غير مصرح بالدخول</h1><p>محرر المحتوى متاح لحساب Editor فقط.</p><a href="index.html">العودة للموقع</a></main>';
      return false;
    }
    $("editorIdentity").textContent = session.user.email + " · Editor";
    return true;
  }

  function resetForm() {
    currentId = null; form.reset(); $("formTitle").textContent = "إضافة عنصر محتوى"; $("saveContentBtn").textContent = "حفظ المحتوى";
  }

  async function loadContent() {
    list.innerHTML = '<div class="editor-help">جاري تحميل المحتوى...</div>';
    const { data, error } = await client.from("site_content").select("*").order("page").order("content_key");
    if (error) { list.innerHTML = '<div class="editor-help">تعذر تحميل المحتوى: '+esc(error.message)+'</div>'; return; }
    if (!data.length) { list.innerHTML = '<div class="editor-help">لا يوجد محتوى محفوظ حتى الآن. أضف أول عنصر من النموذج.</div>'; return; }
    list.innerHTML = data.map(item => `<article class="editor-item">
      <div><strong>${esc(item.content_key)}</strong><small>${esc(item.page)} · ${esc(item.content_type)}</small><small>${esc(item.content_type === "image" ? (item.value_en || item.value_ar || "صورة") : (item.value_ar || item.value_en || ""))}</small></div>
      <div class="editor-item-actions"><button type="button" data-edit="${esc(item.id)}">تعديل</button><button type="button" data-delete="${esc(item.id)}">حذف</button></div>
    </article>`).join("");
    list.dataset.items = JSON.stringify(data);
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const key = $("contentKey").value.trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(key)) { status.textContent = "استخدم حروفًا إنجليزية وأرقامًا ونقاطًا وشرطة فقط في المفتاح."; return; }
    const type = $("contentType").value;
    let valueAr = $("valueAr").value.trim(), valueEn = $("valueEn").value.trim();
    const file = $("contentImage").files[0];
    const button = $("saveContentBtn"); button.disabled = true; status.textContent = "جاري حفظ المحتوى...";
    if (type === "image" && file) {
      if (!file.type.startsWith("image/")) { status.textContent = "الملف المختار ليس صورة."; button.disabled=false; return; }
      const ext = (file.name.split(".").pop() || "image").toLowerCase().replace(/[^a-z0-9]/g,"");
      const filePath = "site/" + key.replace(/[^a-zA-Z0-9/_-]/g,"-") + "-" + crypto.randomUUID() + "." + ext;
      const { error:uploadError } = await client.storage.from("site-media").upload(filePath,file,{upsert:false,contentType:file.type});
      if (uploadError) { status.textContent = "تعذر رفع الصورة: " + uploadError.message; button.disabled=false; return; }
      const { data:publicData } = client.storage.from("site-media").getPublicUrl(filePath);
      valueAr = publicData.publicUrl; valueEn = publicData.publicUrl;
    }
    if (type === "image" && !valueAr && !valueEn) { status.textContent = "ارفع صورة أو أدخل رابط صورة."; button.disabled=false; return; }
    const payload = {content_key:key,page:$("contentPage").value,content_type:type,value_ar:valueAr,value_en:valueEn,updated_at:new Date().toISOString()};
    const result = currentId
      ? await client.from("site_content").update(payload).eq("id",currentId)
      : await client.from("site_content").upsert(payload,{onConflict:"content_key"});
    button.disabled=false;
    if (result.error) { status.textContent = "تعذر حفظ المحتوى: " + result.error.message; return; }
    status.textContent = "تم حفظ المحتوى بنجاح.";
    resetForm(); await loadContent();
  });

  list.addEventListener("click", async event => {
    const editButton = event.target.closest("button[data-edit]");
    const deleteButton = event.target.closest("button[data-delete]");
    const items = JSON.parse(list.dataset.items || "[]");
    if (editButton) {
      const item = items.find(x => x.id === editButton.dataset.edit); if (!item) return;
      currentId=item.id; $("contentKey").value=item.content_key; $("contentPage").value=item.page; $("contentType").value=item.content_type;
      $("valueAr").value=item.value_ar || ""; $("valueEn").value=item.value_en || "";
      $("contentImage").value=""; $("formTitle").textContent="تعديل عنصر المحتوى"; $("saveContentBtn").textContent="حفظ التعديلات";
      window.scrollTo({top:0,behavior:"smooth"}); return;
    }
    if (deleteButton) {
      const item=items.find(x=>x.id===deleteButton.dataset.delete); if(!item || !confirm("هل تريد حذف عنصر المحتوى؟")) return;
      const {error}=await client.from("site_content").delete().eq("id",item.id);
      status.textContent=error ? "تعذر الحذف: "+error.message : "تم حذف عنصر المحتوى.";
      await loadContent();
    }
  });
  $("newContentBtn").addEventListener("click",resetForm);
  $("signOutBtn").addEventListener("click",async()=>{const {error}=await client.auth.signOut();if(error)alert(error.message);else location.replace("login.html");});
  guard().then(ok=>{if(ok)loadContent();});
  client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||!session)location.replace("login.html");});
})();