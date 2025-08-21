import { useEffect, useState, useCallback, useRef } from "react";

export default function usePoll<T>(fn: () => Promise<T>, ms = 5000) {
  const [data, setData] = useState<T>();
  const [err, setErr] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const timerRef = useRef<number | undefined>(undefined);
  const isAliveRef = useRef(true);
  
  const refetch = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    setIsLoading(true);
  }, []);
  
  useEffect(() => {
    isAliveRef.current = true;
    
    const loop = async () => {
      try {
        setErr(undefined);
        const result = await fn();
        
        if (isAliveRef.current) {
          setData(result);
          setIsLoading(false);
        }
      } catch (error: any) {
        if (isAliveRef.current) {
          const errorMessage = error?.message || String(error);
          setErr(errorMessage);
          setIsLoading(false);
          
          // Log error for debugging
          console.error('usePoll error:', error);
        }
      } finally {
        if (isAliveRef.current) {
          timerRef.current = window.setTimeout(loop, ms);
        }
      }
    };
    
    // Start immediately
    loop();
    
    return () => {
      isAliveRef.current = false;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [fn, ms, refreshTrigger]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isAliveRef.current = false;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);
  
  return { data, err, isLoading, refetch };
}
