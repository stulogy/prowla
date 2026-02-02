import React from 'react';
import { LayoutDashboard, Briefcase, Clock, Archive, Search, Zap, BookOpen, Settings, DollarSign } from 'lucide-react';

export default function Sidebar({ activeView, onViewChange, onSearchJobs, searching, onOpenSettings }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'active', label: 'Active Applications', icon: Briefcase },
    { id: 'interviews', label: 'Interviews', icon: Clock },
    { id: 'research', label: 'Research Library', icon: BookOpen },
    { id: 'tokens', label: 'Token Usage', icon: DollarSign },
    { id: 'archive', label: 'Archive', icon: Archive },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <Zap size={18} strokeWidth={2.5} />
          </div>
          <span className="logo-text">JobTracker</span>
        </div>
      </div>

      <div className="sidebar-content">
        <button 
          className="new-job-btn" 
          onClick={onSearchJobs}
          disabled={searching}
          title="Automated search: Scans job boards, filters opportunities, adds to tracker (no login/applications)"
        >
          <Search size={18} strokeWidth={2.5} />
          <span>{searching ? 'Searching...' : 'Scan Job Boards'}</span>
        </button>
        
        <nav className="nav-menu">
          <span className="nav-label">Menu</span>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button className="settings-btn" onClick={onOpenSettings} title="Job Search Settings">
          <Settings size={18} />
          <span>Settings</span>
        </button>
        
        <div className="user-card">
          <div className="user-avatar">JH</div>
          <div className="user-info">
            <span className="user-name">Job Hunter</span>
            <span className="user-status">Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
