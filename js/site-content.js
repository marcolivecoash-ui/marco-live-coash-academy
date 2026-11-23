(() => {
  function loadScript(src) {
    return new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src=src; script.onload=resolve; script.onerror=()=>reject(new Error("Could not load "+src));
      document.head.appendChild(script);
    });
  }
  async function applyContent() {
    try {
      if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      if (!window.MARCO_SUPABASE_URL || !window.MARCO_SUPABASE_PUBLISHABLE_KEY) await loadScript("js/supabase-config.js");
      const client = window.marcoSupabase || window.supabase.createClient(
        window.MARCO_SUPABASE_URL,window.MARCO_SUPABASE_PUBLISHABLE_KEY,
        {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
      );
      window.marcoSupabase = client;
      const {data,error}=await client.from("site_content").select("content_key,content_type,value_ar,value_en");
      if(error){console.warn("Site content could not be loaded:",error.message);return;}
      const lang=document.documentElement.lang==="ar"?"ar":"en";
      (data||[]).forEach(item=>{
        const value=lang==="ar"?(item.value_ar||item.value_en):(item.value_en||item.value_ar);
        if(!value)return;
        document.querySelectorAll('[data-content-key="'+CSS.escape(item.content_key)+'"]').forEach(el=>{
          if(item.content_type==="image"){
            if(el.tagName==="IMG")el.src=value;
            else el.style.backgroundImage='url("'+value.replace(/["\\]/g,"")+'")';
          } else {
            el.textContent=value;
          }
        });
      });
    } catch(error) {
      console.warn("Site content initialization failed:",error);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",applyContent);
  else applyContent();
})();