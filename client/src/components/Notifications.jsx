import React, { useState, useEffect, createContext, useContext } from 'react';
import { Bell, X, CheckCircle, AlertCircle, Info, Loader } from 'lucide-react';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = (message, type = 'info', data = {}) => {
    const id = Date.now() + Math.random();
    const notification = {
      id,
      message,
      type, // 'success', 'error', 'info', 'loading'
      timestamp: new Date(),
      read: false,
      data,
      persistent: true // Keep in history even after toast dismisses
    };
    
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Don't auto-remove from notifications array (keep for history)
    // Toasts will auto-dismiss visually but notification stays in dropdown
    
    return id;
  };

  const updateNotification = (id, updates) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, ...updates } : n)
    );
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        updateNotification,
        removeNotification,
        markAsRead,
        markAllAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function NotificationBell({ onClick }) {
  const { unreadCount } = useNotifications();
  
  return (
    <button className="notification-bell" onClick={onClick}>
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
      )}
    </button>
  );
}

export function NotificationDropdown({ isOpen, onClose, onNotificationClick }) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  
  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} className="notification-icon success" />;
      case 'error': return <AlertCircle size={18} className="notification-icon error" />;
      case 'loading': return <Loader size={18} className="notification-icon loading" />;
      default: return <Info size={18} className="notification-icon info" />;
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return timestamp.toLocaleDateString();
  };

  return (
    <div className="notification-dropdown">
      <div className="notification-header">
        <h3>Notifications</h3>
        {notifications.length > 0 && (
          <button className="mark-all-read" onClick={markAllAsRead}>
            Mark all read
          </button>
        )}
      </div>
      
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <Bell size={32} style={{ opacity: 0.2 }} />
            <p>No notifications</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              className={`notification-item ${notification.read ? 'read' : 'unread'}`}
              onClick={() => {
                markAsRead(notification.id);
                if (notification.data?.jobId && onNotificationClick) {
                  onNotificationClick(notification.data.jobId);
                }
              }}
            >
              {getIcon(notification.type)}
              <div className="notification-content">
                <p className="notification-message">{notification.message}</p>
                <span className="notification-time">{formatTime(notification.timestamp)}</span>
              </div>
              {!notification.read && <span className="unread-dot"></span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Toast component for temporary messages
export function Toast({ message, type = 'info', onClose }) {
  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle size={18} />;
      case 'error': return <AlertCircle size={18} />;
      case 'loading': return <Loader size={18} className="spinning" />;
      default: return <Info size={18} />;
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      {getIcon(type)}
      <span>{message}</span>
      {onClose && (
        <button className="toast-close" onClick={onClose}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function ToastContainer() {
  const { notifications, removeNotification } = useNotifications();
  const [visibleToasts, setVisibleToasts] = React.useState([]);

  React.useEffect(() => {
    // When new notifications arrive, show them as toasts
    notifications.forEach(notification => {
      // Only show as toast if not already shown
      if (!visibleToasts.find(t => t.id === notification.id)) {
        setVisibleToasts(prev => [...prev, notification]);
        
        // Auto-hide toast after 5 seconds (but keep in notification history)
        if (notification.type !== 'loading') {
          setTimeout(() => {
            setVisibleToasts(prev => prev.filter(t => t.id !== notification.id));
          }, 5000);
        }
      }
    });
  }, [notifications]);

  return (
    <div className="toast-container">
      {visibleToasts.map(notification => (
        <Toast
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={() => setVisibleToasts(prev => prev.filter(t => t.id !== notification.id))}
        />
      ))}
    </div>
  );
}
