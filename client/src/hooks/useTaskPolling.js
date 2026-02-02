import { useEffect, useRef } from 'react';

export function useTaskPolling(apiUrl, onTaskComplete, interval = 10000) {
  const previousTasksRef = useRef(new Set());
  const pollingRef = useRef(null);

  useEffect(() => {
    const checkTasks = async () => {
      try {
        const res = await fetch(`${apiUrl}/tasks/status`);
        if (!res.ok) return;
        
        const data = await res.json();
        const currentTasks = new Set(data.tasks.map(t => t.filename));
        
        // Check for completed tasks (were in previous, not in current)
        previousTasksRef.current.forEach(filename => {
          if (!currentTasks.has(filename)) {
            // Task completed!
            const taskType = filename.startsWith('research-') ? 'research' : 'materials';
            const companySlug = filename.replace(/^(research-|generate-materials-)/, '').replace(/\.json$/, '');
            
            if (onTaskComplete) {
              onTaskComplete({ type: taskType, companySlug, filename });
            }
          }
        });
        
        previousTasksRef.current = currentTasks;
      } catch (error) {
        console.error('Task polling error:', error);
      }
    };

    // Initial check
    checkTasks();

    // Set up polling
    pollingRef.current = setInterval(checkTasks, interval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [apiUrl, onTaskComplete, interval]);
}
