import { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import JobTable from './components/JobTable';
import JobModal from './components/JobModal';
import ResearchLibrary from './components/ResearchLibrary';
import Settings from './components/Settings';
import TokenDashboard from './components/TokenDashboard';
import TaskQueue from './components/TaskQueue';
import { NotificationProvider, ToastContainer, useNotifications } from './components/Notifications';
import { useTaskPolling } from './hooks/useTaskPolling';

const API_URL = 'http://localhost:3001/api';

function AppContent() {
  const { addNotification } = useNotifications();
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState(() => {
    const saved = localStorage.getItem('job_tracker_filter');
    return saved ? JSON.parse(saved) : { status: '', priority: '', source: '', onlyNew: false };
  });
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('job_tracker_sort') || 'newest';
  });
  const [applyModal, setApplyModal] = useState(null); // { job, coverLetter, email, ... }
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('job_tracker_view') || 'dashboard';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('job_tracker_theme') || 'light';
  });
  const [searching, setSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('job_tracker_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Task polling - check for completed research/materials tasks
  useTaskPolling(API_URL, (task) => {
    const companyName = task.companySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    if (task.type === 'research') {
      addNotification(`Research completed for ${companyName}`, 'success', { companySlug: task.companySlug });
      fetchJobs(); // Refresh to show updated research
    } else if (task.type === 'materials') {
      addNotification(`Application materials generated for ${companyName}`, 'success', { companySlug: task.companySlug });
      fetchJobs(); // Refresh to show updated materials
    }
  });

  useEffect(() => {
    localStorage.setItem('job_tracker_filter', JSON.stringify(filter));
    localStorage.setItem('job_tracker_sort', sortBy);
    localStorage.setItem('job_tracker_view', activeView);
    
    fetchJobs();
    fetchStats();
  }, [filter, sortBy, activeView]);

  // Handle Sidebar View Changes
  // View changes are now handled by handleViewChange to avoid filter overwrites on mount


  const handleViewChange = (view) => {
    setActiveView(view);
    
    const newFilter = { status: '', priority: '', source: '', onlyNew: false };
    switch (view) {
      case 'active':
        newFilter.status = 'Applied';
        break;
      case 'interviews':
        newFilter.status = 'Interviewing';
        break;
      case 'archive':
        newFilter.status = 'Rejected';
        break;
      default:
        break;
    }
    setFilter(prev => ({ ...prev, ...newFilter }));
  };

  const fetchJobs = async () => {
    const params = new URLSearchParams();
    if (filter.status) params.append('status', filter.status);
    if (filter.priority) params.append('priority', filter.priority);
    if (filter.source) params.append('source', filter.source);
    
    try {
      const res = await fetch(`${API_URL}/jobs?${params}`);
      let data = await res.json();
      
      // Filter for new jobs if enabled (from latest search batch)
      if (filter.onlyNew) {
        data = data.filter(job => job.isNewFromSearch === true);
      }
      
      // Sort jobs
      if (sortBy === 'newest') {
        data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } else if (sortBy === 'priority') {
        const priorityOrder = { '🔴 High': 1, '🟡 Medium': 2, '🟢 Lower': 3 };
        data.sort((a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99));
      } else if (sortBy === 'company') {
        data.sort((a, b) => a.company.localeCompare(b.company));
      }
      
      setJobs(data);
    } catch (err) {
      console.error("Failed to fetch jobs", err);
    }
  };
  
  // Check if job is from the latest search batch (true diff)
  const isNewJob = (job) => {
    return job.isNewFromSearch === true;
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const updateStatus = async (id, newStatus) => {
    await fetch(`${API_URL}/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: newStatus,
        applied_date: newStatus === 'Applied' || newStatus === 'Done' ? new Date().toISOString().split('T')[0] : null
      })
    });
    fetchJobs();
    fetchStats();
  };

  const deleteJob = async (id) => {
    // TODO: Replace with custom modal confirm
    if (!window.confirm('Are you sure you want to delete this job? This will move it to the rejected companies list.')) return;
    
    try {
      await fetch(`${API_URL}/jobs/${id}`, { method: 'DELETE' });
      addNotification('Job deleted and added to rejected list', 'success');
      fetchJobs();
      fetchStats();
    } catch (e) {
      addNotification('Failed to delete job', 'error');
    }
  };

  const openApplyModal = async (jobOrId) => {
    // Handle both job object and job ID
    let job = jobOrId;
    
    // If it's just an ID, fetch the full job
    if (typeof jobOrId === 'number') {
      try {
        job = await fetch(`${API_URL}/jobs/${jobOrId}`).then(r => r.json());
      } catch (e) {
        console.error('Failed to fetch job:', e);
        return;
      }
    }
    
    // Fetch materials from file system
    try {
        const materials = await fetch(`${API_URL}/jobs/${job.id}/materials`).then(r => r.json()).catch(() => ({}));
        setApplyModal({ job, ...materials });
    } catch (e) {
        setApplyModal({ job });
    }
  };

  const closeApplyModal = () => {
    setApplyModal(null);
  };

  const markAsApplied = async () => {
    if (applyModal?.job) {
      await updateStatus(applyModal.job.id, 'Applied');
      closeApplyModal();
    }
  };

  const searchForJobs = async () => {
    try {
      setSearching(true);
      addNotification('Starting job board scan...', 'loading');
      
      const res = await fetch(`${API_URL}/search`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        
        // Wait a moment for the search to complete and database to reload
        setTimeout(async () => {
          await fetchJobs();
          await fetchStats();
          setSearching(false);
          addNotification('Job search complete! Check for new opportunities.', 'success');
        }, 3000); // Give the search script time to run
      } else {
        setSearching(false);
        addNotification('Failed to start job search', 'error');
      }
    } catch (e) {
      setSearching(false);
      addNotification('Search error: ' + e.message, 'error');
    }
  };

  // Calculate new jobs count for dashboard
  const newCount = jobs.filter(j => isNewJob(j)).length;

  // Filter jobs based on search query
  const filteredJobs = searchQuery 
    ? jobs.filter(job => {
        const query = searchQuery.toLowerCase();
        return (
          job.company.toLowerCase().includes(query) ||
          job.role.toLowerCase().includes(query) ||
          (job.type && job.type.toLowerCase().includes(query)) ||
          (job.source && job.source.toLowerCase().includes(query)) ||
          (job.location && job.location.toLowerCase().includes(query)) ||
          (job.notes && job.notes.toLowerCase().includes(query))
        );
      })
    : jobs;

  return (
    <div className="app-container">
      <Sidebar 
        activeView={activeView} 
        onViewChange={handleViewChange} 
        onSearchJobs={searchForJobs}
        searching={searching}
        onOpenSettings={() => setShowSettings(true)}
      />
      
      <main className="main-content">
        <Header 
            title={activeView === 'dashboard' ? 'Dashboard' : activeView.charAt(0).toUpperCase() + activeView.slice(1)} 
            theme={theme}
            onToggleTheme={toggleTheme}
            onNotificationClick={openApplyModal}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
        />
        
        <div className="content-scrollable">
          {activeView === 'dashboard' && (
             <StatsCards stats={stats} newCount={searchQuery ? filteredJobs.filter(j => isNewJob(j)).length : newCount} />
          )}

          {activeView === 'research' ? (
            <ResearchLibrary 
              apiUrl={API_URL}
              onSelectJob={openApplyModal}
            />
          ) : activeView === 'tokens' ? (
            <TokenDashboard 
              apiUrl={API_URL}
            />
          ) : (
            <JobTable 
              jobs={filteredJobs}
              updateStatus={updateStatus}
              deleteJob={deleteJob}
              openApplyModal={openApplyModal}
              filter={filter}
              setFilter={setFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              isNewJob={isNewJob}
              formatDate={formatDate}
            />
          )}
        </div>
      </main>

      {applyModal && (
        <JobModal 
          modalData={applyModal}
          onClose={closeApplyModal}
          onMarkApplied={markAsApplied}
          apiUrl={API_URL}
          addNotification={addNotification}
        />
      )}
      
      <ToastContainer />
      
      <TaskQueue apiUrl={API_URL} />
      
      {showSettings && (
        <Settings
          apiUrl={API_URL}
          onClose={() => setShowSettings(false)}
          addNotification={addNotification}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}
