import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, FileText, Search, X } from 'lucide-react';

export default function TaskQueue({ apiUrl }) {
  const [tasks, setTasks] = useState([]);
  const [expanded, setExpanded] = useState(true); // Start expanded by default

  useEffect(() => {
    // Poll for tasks every 3 seconds
    const checkTasks = async () => {
      try {
        const res = await fetch(`${apiUrl}/tasks/status`);
        if (res.ok) {
          const data = await res.json();
          console.log('TaskQueue: Fetched tasks', data);
          setTasks(data.tasks);
        }
      } catch (e) {
        console.error('TaskQueue: Error fetching tasks', e);
      }
    };

    checkTasks();
    const interval = setInterval(checkTasks, 3000);

    return () => clearInterval(interval);
  }, [apiUrl]);

  const dismissTask = async (filename, e) => {
    e.stopPropagation(); // Prevent expanding/collapsing
    try {
      const res = await fetch(`${apiUrl}/tasks/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // Remove from local state immediately
        setTasks(prev => prev.filter(t => t.filename !== filename));
      }
    } catch (e) {
      console.error('Error dismissing task:', e);
    }
  };

  console.log('TaskQueue: Rendering with', tasks.length, 'tasks');

  if (tasks.length === 0) return null;

  const getTaskIcon = (type) => {
    if (type === 'research') return <Search size={14} />;
    return <FileText size={14} />;
  };

  const getTaskLabel = (type) => {
    if (type === 'research') return 'Research';
    return 'Materials';
  };

  return (
    <div className="task-queue">
      <div className="task-queue-header" onClick={() => setExpanded(!expanded)}>
        <div className="task-queue-title">
          <Clock size={16} className="spinning" />
          <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''} processing...</span>
        </div>
        <button className="task-queue-toggle">
          {expanded ? '▼' : '▲'}
        </button>
      </div>
      
      {expanded && (
        <div className="task-queue-list">
          {tasks.map((task, idx) => (
            <div key={task.filename} className="task-queue-item">
              <div className="task-icon">
                {getTaskIcon(task.type)}
              </div>
              <div className="task-info">
                <span className="task-company">{task.company}</span>
                <span className="task-type">{getTaskLabel(task.type)}</span>
              </div>
              <div className="task-status">
                <div className="task-spinner"></div>
                <button
                  className="task-dismiss"
                  onClick={(e) => dismissTask(task.filename, e)}
                  title="Dismiss task"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
