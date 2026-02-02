import React from 'react';
import { Layers, Send, Users, Circle, TrendingUp } from 'lucide-react';

export default function StatsCards({ stats, newCount }) {
  const cards = [
    { 
      label: 'Total Jobs', 
      value: stats.total || 0, 
      icon: Layers, 
      color: 'blue',
      change: '+12% this week' 
    },
    { 
      label: 'Applications', 
      value: stats.applied || 0, 
      icon: Send, 
      color: 'purple',
      change: 'Active now' 
    },
    { 
      label: 'Interviews', 
      value: stats.interviewing || 0, 
      icon: Users, 
      color: 'orange',
      change: 'Upcoming' 
    },
    { 
      label: 'Pending', 
      value: stats.notStarted || 0, 
      icon: Circle, 
      color: 'gray',
      change: 'To apply' 
    },
  ];

  if (newCount > 0) {
    cards.splice(1, 0, {
      label: 'New Leads',
      value: newCount,
      icon: TrendingUp,
      color: 'green',
      change: 'Latest search'
    });
  }

  return (
    <div className="stats-grid">
      {cards.map((card, i) => (
        <div key={i} className={`stat-card color-${card.color}`}>
          <div className="stat-header">
            <span className="stat-label">{card.label}</span>
            <div className="stat-icon-bg">
              <card.icon size={20} />
            </div>
          </div>
          <div className="stat-body">
            <span className="stat-value">{card.value}</span>
            <span className="stat-change">{card.change}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
