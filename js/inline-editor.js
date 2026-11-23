(() => {
const start=async()=>{
 const client=window.marcoSupabase;if(!client)return;
 const {data:sessionData}=await client.auth.getSession();if(!sessionData.session)return;
 const {data:isEditor,error:roleError}=await client.rpc("is_marco_editor");if(roleError||isEditor!==true)return;
 const pageName=(location.pathname.split("/").pop()||"index.html").replace(".html","");
 const pageKey=pageName==="index"?"home":pageName;
 const {data:rows,error}=await client.from("site_content").select("content_key,content_type,value_ar,value_en").eq("page",pageKey);
 if(error){console.warn("Editor load:",error.message);return;}
 const saved=new Map((rows||[]).map(r=>[r.content_key,r]));
 const layout=saved.get("page.layout");
 const main=document.querySelector("main");if(!main)return;
 if(layout){const markup=document.documentElement.lang==="ar"?(layout.value_ar||layout.value_en):(layout.value_en||layout.value_ar);if(markup)main.innerHTML=markup;}
 const lang=()=>document.documentElement.lang==="ar"?"ar":"en";
 const css=document.createElement("style");
 css.textContent="#marco-editor-toolbar{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:7px;max-width:calc(100% - 20px);padding:9px 12px;border:1px solid #ffffff30;border-radius:16px;background:rgba(8,18,35,.93);backdrop-filter:blur(22px);box-shadow:0 12px 38px #0006;color:#fff;font:600 13px system-ui;direction:rtl}#marco-editor-toolbar button{border:0;border-radius:10px;padding:9px 12px;font:700 12px system-ui;cursor:pointer;white-space:nowrap}#marco-editor-toolbar .primary{background:linear-gradient(120deg,#1677ff,#24c9ef);color:#fff}#marco-editor-toolbar .save{display:none;background:#13a36b;color:#fff}#marco-editor-toolbar .cancel{display:none;background:#ffffff20;color:#fff}#marco-editor-status{font-size:11px;color:#b9eaff;max-width:190px}body.marco-edit-mode [data-marco-editable='1']{outline:1px dashed #29d7ff!important;outline-offset:4px;cursor:text;min-width:10px}body.marco-edit-mode [data-marco-image='1']{outline:2px dashed #29d7ff!important;outline-offset:4px;cursor:pointer}body.marco-edit-mode [data-marco-section]{position:relative;outline:1px solid #29d7ff55}body.marco-edit-mode [data-marco-section]>.marco-section-tools{position:absolute;top:8px;inset-inline-end:8px;z-index:50;display:flex;gap:5px} .marco-section-tools button{border:1px solid #ffffff40;background:#101d32;color:white;border-radius:7px;padding:5px 8px;cursor:pointer;font:12px system-ui}#marco-section-add{display:none;background:#6848db;color:#fff}body.marco-edit-mode #marco-section-add{display:inline-block}@media(max-width:600px){#marco-editor-toolbar{top:6px;gap:4px;padding:6px}#marco-editor-toolbar button{padding:8px 9px;font-size:11px}#marco-editor-status{max-width:105px}}";
 document.head.appendChild(css);
 const toolbar=document.createElement("div");toolbar.id="marco-editor-toolbar";
 toolbar.innerHTML='<button id="marco-editor-start" class="primary">✏️ تحرير الصفحة</button><button id="marco-section-add">＋ إضافة قسم</button><button id="marco-editor-save" class="save">حفظ ونشر</button><button id="marco-editor-cancel" class="cancel">إلغاء</button><span id="marco-editor-status">محرر الصفحة جاهز</span>';
 document.body.appendChild(toolbar);
 const startBtn=toolbar.querySelector("#marco-editor-start"),addBtn=toolbar.querySelector("#marco-section-add"),saveBtn=toolbar.querySelector("#marco-editor-save"),cancelBtn=toolbar.querySelector("#marco-editor-cancel"),status=toolbar.querySelector("#marco-editor-status");
 const originals=new Map();let active=false;let selectedImage=null;
 const imageInput=document.createElement("input");imageInput.type="file";imageInput.accept="image/*";imageInput.hidden=true;document.body.appendChild(imageInput);
 function assignKeys(){
  const nodes=[...main.querySelectorAll("h1,h2,h3,h4,p,li,.eyebrow,.card-icon,.stat strong,.stat span")];
  const leaves=nodes.filter(el=>!el.closest("form,button,a")&&!nodes.some(p=>p!==el&&p.contains(el)));
  const counts={};
  leaves.forEach(el=>{if(!el.dataset.contentKey){const tag=el.tagName.toLowerCase();counts[tag]=(counts[tag]||0)+1;el.dataset.contentKey="inline."+pageKey+"."+tag+"."+counts[tag];}el.dataset.marcoEditable="1";});
  const imgs=[...main.querySelectorAll("img")].filter(x=>!x.closest("a,button,form"));
  imgs.forEach((img,i)=>{if(!img.dataset.contentKey)img.dataset.contentKey="inline."+pageKey+".image."+(i+1);img.dataset.marcoImage="1";});
  return {leaves,imgs};
 }
 let refs=assignKeys();
 function applySaved(){
  refs.leaves.forEach(el=>{const item=saved.get(el.dataset.contentKey);if(item&&item.content_type==="text"){const v=lang()==="ar"?(item.value_ar||item.value_en):(item.value_en||item.value_ar);if(v!=null)el.innerHTML=v;el.dataset.ar=item.value_ar||"";el.dataset.en=item.value_en||"";}});
  refs.imgs.forEach(img=>{const item=saved.get(img.dataset.contentKey);if(item&&item.content_type==="image")img.src=item.value_en||item.value_ar;});
 }
 applySaved();
 function addSectionTools(){
  main.querySelectorAll(":scope > section").forEach((section,index)=>{
   section.dataset.marcoSection="1";
   if(section.querySelector(":scope > .marco-section-tools"))return;
   const tools=document.createElement("div");tools.className="marco-section-tools";
   tools.innerHTML='<button type="button" data-act="up" title="تحريك لأعلى">↑</button><button type="button" data-act="down" title="تحريك لأسفل">↓</button><button type="button" data-act="color" title="لون الخلفية">◐</button><button type="button" data-act="delete" title="حذف القسم">✕</button>';
   tools.addEventListener("click",e=>{
    const btn=e.target.closest("button");if(!btn)return;
    const act=btn.dataset.act;
    if(act==="up"&&section.previousElementSibling)main.insertBefore(section,section.previousElementSibling);
    if(act==="down"&&section.nextElementSibling)main.insertBefore(section.nextElementSibling,section);
    if(act==="delete"){if(confirm("متأكد إنك عايز تحذف القسم ده؟"))section.remove();}
    if(act==="color"){const color=prompt("اكتب لون الخلفية (مثال #101b30 أو transparent):",section.style.backgroundColor||"");if(color!==null)section.style.background=color;}
   });
   section.appendChild(tools);
  });
 }
 function cleanMarkup(){
  const clone=main.cloneNode(true);
  clone.querySelectorAll(".marco-section-tools").forEach(n=>n.remove());
  clone.querySelectorAll("[contenteditable]").forEach(n=>n.removeAttribute("contenteditable"));
  clone.querySelectorAll("[data-marco-editable]").forEach(n=>n.removeAttribute("data-marco-editable"));
  clone.querySelectorAll("[data-marco-image]").forEach(n=>n.removeAttribute("data-marco-image"));
  clone.querySelectorAll("[data-marco-section]").forEach(n=>n.removeAttribute("data-marco-section"));
  return clone.innerHTML;
 }
 function enterEdit(){
  active=true;originals.clear();refs=assignKeys();
  refs.leaves.forEach(el=>{originals.set(el,{html:el.innerHTML});el.contentEditable="true";el.spellcheck=true;});
  refs.imgs.forEach(img=>originals.set(img,{src:img.src}));
  document.body.classList.add("marco-edit-mode");addSectionTools();
  startBtn.style.display="none";saveBtn.style.display="inline-block";cancelBtn.style.display="inline-block";
  status.textContent="عدّل النصوص والصور، وأضف أو رتّب الأقسام";
 }
 function leaveEdit(restore){
  if(restore)originals.forEach((old,el)=>{if(el.tagName==="IMG")el.src=old.src;else el.innerHTML=old.html;});
  refs.leaves.forEach(el=>el.contentEditable="false");
  main.querySelectorAll(".marco-section-tools").forEach(n=>n.remove());
  document.body.classList.remove("marco-edit-mode");active=false;
  startBtn.style.display="inline-block";saveBtn.style.display="none";cancelBtn.style.display="none";
 }
 startBtn.addEventListener("click",enterEdit);
 cancelBtn.addEventListener("click",()=>{if(confirm("إلغاء كل التعديلات غير المحفوظة؟")){leaveEdit(true);status.textContent="تم إلغاء التعديلات";}});
 addBtn.addEventListener("click",()=>{
  if(!active)return;
  const section=document.createElement("section");section.className="section";section.dataset.marcoSection="1";
  section.innerHTML='<div class="container"><div class="section-header center"><span class="eyebrow" data-en="NEW SECTION" data-ar="قسم جديد">NEW SECTION</span><h2 data-en="Your New Heading" data-ar="عنوان القسم الجديد">Your New Heading</h2><p data-en="Write your section description here." data-ar="اكتب وصف القسم هنا.">Write your section description here.</p></div></div>';
  main.appendChild(section);
  refs=assignKeys();
  const fresh=section.querySelectorAll("h2,p,.eyebrow");
  fresh.forEach((el,i)=>{el.dataset.contentKey="custom."+pageKey+"."+Date.now()+"."+i;el.dataset.marcoEditable="1";el.contentEditable="true";});
  addSectionTools();status.textContent="أضفت قسمًا جديدًا — عدّل نصوصه";
 });
 main.addEventListener("click",e=>{
  const img=e.target.closest("img[data-marco-image]");
  if(active&&img&&!img.closest("a,button,form")){selectedImage=img;imageInput.click();}
 });
 imageInput.addEventListener("change",async()=>{
  if(!selectedImage||!imageInput.files||!imageInput.files[0])return;
  const file=imageInput.files[0];status.textContent="جاري رفع الصورة...";
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
  const path=pageKey+"/"+selectedImage.dataset.contentKey.replace(/[^a-zA-Z0-9._-]/g,"-")+"-"+Date.now()+"."+ext;
  const {error:uploadError}=await client.storage.from("site-media").upload(path,file,{upsert:true,contentType:file.type||"image/jpeg",cacheControl:"3600"});
  if(uploadError){status.textContent="فشل رفع الصورة: "+uploadError.message;imageInput.value="";return;}
  const {data}=client.storage.from("site-media").getPublicUrl(path);selectedImage.src=data.publicUrl;status.textContent="تم رفع الصورة — احفظ لنشرها";imageInput.value="";
 });
 saveBtn.addEventListener("click",async()=>{
  if(!active)return;saveBtn.disabled=true;status.textContent="جاري حفظ الصفحة...";
  refs=assignKeys();const payloads=[];
  refs.leaves.forEach(el=>{
   const key=el.dataset.contentKey,old=originals.get(el),previous=saved.get(key)||{};
   if(old&&el.innerHTML===old.html)return;
   const html=el.innerHTML;const ar=lang()==="ar"?html:(el.dataset.ar||previous.value_ar||html);
   const en=lang()==="en"?html:(el.dataset.en||previous.value_en||html);
   payloads.push({content_key:key,page:pageKey,content_type:"text",value_ar:ar,value_en:en,updated_at:new Date().toISOString(),updated_by:sessionData.session.user.id});
  });
  refs.imgs.forEach(img=>{const old=originals.get(img);if(old&&img.src===old.src)return;payloads.push({content_key:img.dataset.contentKey,page:pageKey,content_type:"image",value_ar:img.src,value_en:img.src,updated_at:new Date().toISOString(),updated_by:sessionData.session.user.id});});
  const markup=cleanMarkup();
  payloads.push({content_key:"page.layout",page:pageKey,content_type:"layout",value_ar:markup,value_en:markup,updated_at:new Date().toISOString(),updated_by:sessionData.session.user.id});
  const {error:saveError}=await client.from("site_content").upsert(payloads,{onConflict:"content_key"});saveBtn.disabled=false;
  if(saveError){status.textContent="فشل الحفظ: "+saveError.message;return;}
  payloads.forEach(item=>saved.set(item.content_key,item));
  leaveEdit(false);status.textContent="✓ تم نشر تغييرات الصفحة";
  setTimeout(()=>{if(!active)status.textContent="محرر الصفحة جاهز";},5000);
 });
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,800));else setTimeout(start,800);
})();