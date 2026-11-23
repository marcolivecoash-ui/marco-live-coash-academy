(() => {
const start = async () => {
 const client=window.marcoSupabase;if(!client)return;
 const {data:sessionData}=await client.auth.getSession();if(!sessionData.session)return;
 const {data:isEditor,error:roleError}=await client.rpc("is_marco_editor");if(roleError||isEditor!==true)return;
 const pageName=(location.pathname.split("/").pop()||"index.html").replace(".html","");
 const pageKey=pageName==="index"?"home":pageName;
 const {data:rows,error}=await client.from("site_content").select("content_key,content_type,value_ar,value_en").eq("page",pageKey);
 if(error){console.warn("Editor load:",error.message);return;}
 const saved=new Map((rows||[]).map(row=>[row.content_key,row]));
 const currentLang=()=>document.documentElement.lang==="ar"?"ar":"en";
 const style=document.createElement("style");
 style.textContent="#marco-editor-toolbar{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(8,18,35,.9);backdrop-filter:blur(22px);box-shadow:0 12px 38px #0006;color:#fff;font:600 13px system-ui;direction:rtl}#marco-editor-toolbar button{border:0;border-radius:10px;padding:10px 15px;font:700 13px system-ui;cursor:pointer;white-space:nowrap}#marco-editor-start{background:linear-gradient(120deg,#1677ff,#24c9ef);color:#fff}#marco-editor-save{display:none;background:#13a36b;color:#fff}#marco-editor-cancel{display:none;background:#ffffff1c;color:#fff}#marco-editor-status{font-size:11px;color:#b9eaff;max-width:210px}body.marco-edit-mode [data-marco-editable='1']{outline:1px dashed #29d7ff!important;outline-offset:5px;cursor:text;min-width:12px}body.marco-edit-mode [data-marco-image='1']{outline:2px dashed #29d7ff!important;outline-offset:5px;cursor:pointer}body.marco-edit-mode [data-marco-editable='1']:focus{outline:2px solid #29d7ff!important;background:rgba(40,217,255,.045)}@media(max-width:600px){#marco-editor-toolbar{top:8px;width:calc(100% - 16px);justify-content:center;gap:5px;padding:7px}#marco-editor-toolbar button{padding:9px 10px;font-size:12px}#marco-editor-status{max-width:105px}}";
 document.head.appendChild(style);
 const main=document.querySelector("main");if(!main)return;
 const candidates=[...main.querySelectorAll("h1,h2,h3,h4,p,li,.eyebrow,.card-icon,.stat strong,.stat span")];
 const editable=candidates.filter(el=>!el.closest("form,button,a")&&!candidates.some(parent=>parent!==el&&parent.contains(el)));
 const images=[...main.querySelectorAll("img")].filter(img=>!img.closest("a,button,form"));
 const counters={};
 editable.forEach(el=>{
  const tag=el.tagName.toLowerCase();counters[tag]=(counters[tag]||0)+1;
  if(!el.dataset.contentKey)el.dataset.contentKey="inline."+pageKey+"."+tag+"."+counters[tag];
  el.dataset.marcoEditable="1";
  const item=saved.get(el.dataset.contentKey);
  if(item&&item.content_type==="text"){
   const value=currentLang()==="ar"?(item.value_ar||item.value_en):(item.value_en||item.value_ar);
   if(value!=null)el.innerHTML=value;
   el.dataset.ar=item.value_ar||"";el.dataset.en=item.value_en||"";
  }
 });
 images.forEach((img,i)=>{
  if(!img.dataset.contentKey)img.dataset.contentKey="inline."+pageKey+".image."+(i+1);
  img.dataset.marcoImage="1";const item=saved.get(img.dataset.contentKey);
  if(item&&item.content_type==="image")img.src=item.value_en||item.value_ar;
 });
 const toolbar=document.createElement("div");toolbar.id="marco-editor-toolbar";
 toolbar.innerHTML='<button id="marco-editor-start">✏️ تحرير الصفحة</button><button id="marco-editor-save">حفظ ونشر</button><button id="marco-editor-cancel">إلغاء</button><span id="marco-editor-status">وضع المحرر جاهز</span>';
 document.body.appendChild(toolbar);
 const startBtn=toolbar.querySelector("#marco-editor-start"),saveBtn=toolbar.querySelector("#marco-editor-save"),cancelBtn=toolbar.querySelector("#marco-editor-cancel"),status=toolbar.querySelector("#marco-editor-status");
 const originals=new Map();let active=false;
 const imageInput=document.createElement("input");imageInput.type="file";imageInput.accept="image/*";imageInput.hidden=true;document.body.appendChild(imageInput);
 let selectedImage=null;
 function enterEdit(){
  active=true;originals.clear();
  editable.forEach(el=>{originals.set(el,{html:el.innerHTML});el.contentEditable="true";el.spellcheck=true;});
  images.forEach(img=>originals.set(img,{src:img.src}));
  document.body.classList.add("marco-edit-mode");startBtn.style.display="none";saveBtn.style.display="inline-block";cancelBtn.style.display="inline-block";
  status.textContent="اضغط على النص لتعديله أو صورة لتغييرها";
 }
 function leaveEdit(restore){
  if(restore)originals.forEach((old,el)=>{if(el.tagName==="IMG")el.src=old.src;else el.innerHTML=old.html;});
  editable.forEach(el=>{el.contentEditable="false";});
  document.body.classList.remove("marco-edit-mode");active=false;startBtn.style.display="inline-block";saveBtn.style.display="none";cancelBtn.style.display="none";
 }
 startBtn.addEventListener("click",enterEdit);
 cancelBtn.addEventListener("click",()=>{leaveEdit(true);status.textContent="تم إلغاء التعديلات";});
 images.forEach(img=>img.addEventListener("click",()=>{if(active){selectedImage=img;imageInput.click();}}));
 imageInput.addEventListener("change",async()=>{
  if(!selectedImage||!imageInput.files||!imageInput.files[0])return;
  const file=imageInput.files[0];status.textContent="جاري رفع الصورة...";
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
  const path=pageKey+"/"+selectedImage.dataset.contentKey.replace(/[^a-zA-Z0-9._-]/g,"-")+"-"+Date.now()+"."+ext;
  const {error:uploadError}=await client.storage.from("site-media").upload(path,file,{upsert:true,contentType:file.type||"image/jpeg",cacheControl:"3600"});
  if(uploadError){status.textContent="فشل رفع الصورة: "+uploadError.message;imageInput.value="";return;}
  const {data:publicData}=client.storage.from("site-media").getPublicUrl(path);
  selectedImage.src=publicData.publicUrl;status.textContent="تم اختيار الصورة — اضغط حفظ ونشر";imageInput.value="";
 });
 saveBtn.addEventListener("click",async()=>{
  if(!active)return;saveBtn.disabled=true;status.textContent="جاري حفظ التعديلات...";
  const payloads=[];
  editable.forEach(el=>{
   const key=el.dataset.contentKey,old=originals.get(el);if(!old||el.innerHTML===old.html)return;
   const html=el.innerHTML,previous=saved.get(key)||{};
   const ar=currentLang()==="ar"?html:(el.dataset.ar||previous.value_ar||html);
   const en=currentLang()==="en"?html:(el.dataset.en||previous.value_en||html);
   payloads.push({content_key:key,page:pageKey,content_type:"text",value_ar:ar,value_en:en,updated_at:new Date().toISOString(),updated_by:sessionData.session.user.id});
  });
  images.forEach(img=>{
   const old=originals.get(img);if(old&&img.src!==old.src)payloads.push({content_key:img.dataset.contentKey,page:pageKey,content_type:"image",value_ar:img.src,value_en:img.src,updated_at:new Date().toISOString(),updated_by:sessionData.session.user.id});
  });
  if(!payloads.length){saveBtn.disabled=false;status.textContent="لا توجد تغييرات جديدة";return;}
  const {error:saveError}=await client.from("site_content").upsert(payloads,{onConflict:"content_key"});saveBtn.disabled=false;
  if(saveError){status.textContent="فشل الحفظ: "+saveError.message;return;}
  payloads.forEach(item=>saved.set(item.content_key,item));
  payloads.filter(item=>item.content_type==="text").forEach(item=>{
   const el=editable.find(node=>node.dataset.contentKey===item.content_key);
   if(el){el.dataset.ar=item.value_ar||"";el.dataset.en=item.value_en||"";}
  });
  leaveEdit(false);status.textContent="✓ تم حفظ ونشر التعديلات";
  setTimeout(()=>{if(!active)status.textContent="وضع المحرر جاهز";},4500);
 });
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,700));else setTimeout(start,700);
})();