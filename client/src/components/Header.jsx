import React, { useState } from 'react';
import { Search, Sun, Moon } from 'lucide-react';
import { NotificationBell, NotificationDropdown } from './Notifications';

export default function Header({ title, theme, onToggleTheme, onNotificationClick, searchQuery, onSearchChange }) {
  const [showNotifications, setShowNotifications] = useState(false);
  
  return (
    <header className="main-header">
      <h2 className="header-title">{title}</h2>
      
      <div className="header-actions">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search companies, roles..." 
            className="search-input"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
        </div>
        
        <button className="icon-btn" onClick={onToggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        
        <NotificationBell onClick={() => setShowNotifications(!showNotifications)} />
        <NotificationDropdown 
          isOpen={showNotifications} 
          onClose={() => setShowNotifications(false)}
          onNotificationClick={(jobId) => {
            setShowNotifications(false);
            if (onNotificationClick) onNotificationClick(jobId);
          }}
        />
      </div>
    </header>
  );
}
