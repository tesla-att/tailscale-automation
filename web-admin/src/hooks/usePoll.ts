import { useEffect, useState } from "react";
export default function usePoll<T>(fn:()=>Promise<T>, ms=5000){
  const [data,setData]=useState<T>(); const [err,setErr]=useState<string>();
  useEffect(()=>{
    let alive = true; let timer:number;
    const loop = async()=>{
      try{ const d = await fn(); if(alive) setData(d); }
      catch(e:any){ if(alive) setErr(String(e)); }
      finally { if(alive) timer = window.setTimeout(loop, ms); }
    };
    loop(); return ()=>{ alive=false; window.clearTimeout(timer);}
  },[ms]);
  return {data,err};
}
