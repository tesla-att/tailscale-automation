import { useEffect, useState, useCallback } from "react";
export default function usePoll<T>(fn:()=>Promise<T>, ms=5000){
  const [data,setData]=useState<T>(); 
  const [err,setErr]=useState<string>();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const refetch = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);
  
  useEffect(()=>{
    let alive = true; let timer:number;
    const loop = async()=>{
      try{ 
        setErr(undefined); // Clear previous errors
        const d = await fn(); 
        if(alive) setData(d); 
      }
      catch(e:any){ if(alive) setErr(String(e)); }
      finally { if(alive) timer = window.setTimeout(loop, ms); }
    };
    loop(); return ()=>{ alive=false; window.clearTimeout(timer);}
  },[ms, refreshTrigger]);
  
  return {data,err,refetch};
}
