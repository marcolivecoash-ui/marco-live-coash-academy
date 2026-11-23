(() => {
 async function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error("Could not load "+src));document.head.appendChild(s);});}
 async function applyContent(){
  try{
   if(!window.supabase)await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
   if(!window.MARCO_SUPABASE_URL||!window.MARCO_SUPABASE_PUBLISHABLE_KEY)await loadScript("js/supabase-config.js");
   const client=window.marcoSupabase||window.supabase.createClient(window.MARCO_SUPABASE_URL,window.MARCO_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   window.marcoSupabase=client;
   const {data,error}=await client.from("site_content").select("content_key,content_type,value_ar,value_en");
   if(error){console.warn("Site content could not be loaded:",error.message);return;}
   const page=(location.pathname.split("/").pop()||"index.html").replace(".html","");
   const pageKey=page==="index"?"home":page;
   const pageRows=(data||[]).filter(x=>x.page===pageKey);
   const lang=document.documentElement.lang==="ar"?"ar":"en";
   const layout=pageRows.find(x=>x.content_key==="page.layout");
   const main=document.querySelector("main");
   if(layout&&main){const html=lang==="ar"?(layout.value_ar||layout.value_en):(layout.value_en||layout.value_ar);if(html)main.innerHTML=html;}
   pageRows.forEach(item=>{
    if(item.content_key==="page.layout")return;
    const value=lang==="ar"?(item.value_ar||item.value_en):(item.value_en||item.value_ar);
    if(!value)return;
    document.querySelectorAll('[data-content-key="'+CSS.escape(item.content_key)+'"]').forEach(el=>{
     if(item.content_type==="image"){if(el.tagName==="IMG")el.src=value;else el.style.backgroundImage='url("'+value.replace(/["\\]/g,"")+'")';}
     else if(item.content_type==="text")el.innerHTML=value;
    });
   });
  }catch(error){console.warn("Site content initialization failed:",error);}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",applyContent);else applyContent();
})();