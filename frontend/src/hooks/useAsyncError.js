import { useState, useCallback } from 'react';

/**
 * Hook to handle asynchronous errors and surface them to the nearest Error Boundary.
 * React Error Boundaries only catch errors during the render phase. 
 * This hook allows catching errors in async code (like setTimeouts or API calls) 
 * by re-throwing them during the next render.
 */
export function useAsyncError() {
  const [, setError] = useState();

  return useCallback(
    (error) => {
      setError(() => {
        throw error;
      });
    },
    []
  );
}
