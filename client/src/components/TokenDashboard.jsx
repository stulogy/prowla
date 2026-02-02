import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Activity, Calendar } from 'lucide-react';

export default function TokenDashboard({ apiUrl }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days');

  useEffect(() => {
    fetchUsage();
  }, [dateRange]);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date().toISOString();
      const startDate = new Date();
      if (dateRange === '1day') {
        startDate.setDate(startDate.getDate() - 1);
      } else if (dateRange === '7days') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateRange === '30days') {
        startDate.setDate(startDate.getDate() - 30);
      }
      
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate
      });
      
      const res = await fetch(`${apiUrl}/tokens?${params}`);
      const data = await res.json();
      setUsage(data);
    } catch (error) {
      console.error('Failed to fetch token usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="token-dashboard">
        <h2>Token Usage & Costs</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="token-dashboard">
        <h2>Token Usage & Costs</h2>
        <p>No data available</p>
      </div>
    );
  }

  const { summary, entries } = usage;
  
  // Format currency
  const fmt = (amount) => `$${amount.toFixed(2)}`;
  
  // Format tokens
  const fmtTokens = (tokens) => {
    if (tokens > 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens > 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens;
  };

  // Sort days by date
  const sortedDays = Object.entries(summary.byDay || {}).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="token-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Token Usage & Costs</h2>
          <p className="dashboard-subtitle">Track your Clawdbot automation spending</p>
        </div>
        
        <select 
          value={dateRange} 
          onChange={(e) => setDateRange(e.target.value)}
          className="date-range-select"
        >
          <option value="1day">Last 24 Hours</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Cost</span>
            <span className="stat-value">{fmt(summary.totalCost)}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Tokens</span>
            <span className="stat-value">{fmtTokens(summary.totalTokens)}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Tasks Run</span>
            <span className="stat-value">{entries.length}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Avg Daily</span>
            <span className="stat-value">
              {fmt(summary.totalCost / Object.keys(summary.byDay || {}).length || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* By Task Type */}
      <div className="usage-section">
        <h3>Cost by Task Type</h3>
        <div className="usage-bars">
          {Object.entries(summary.byTaskType || {}).map(([taskType, data]) => {
            const percentage = (data.cost / summary.totalCost) * 100;
            return (
              <div key={taskType} className="usage-bar-container">
                <div className="usage-bar-label">
                  <span className="task-type">{taskType}</span>
                  <span className="task-stats">
                    {data.count} tasks • {fmt(data.cost)}
                  </span>
                </div>
                <div className="usage-bar-track">
                  <div 
                    className="usage-bar-fill" 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* By Day */}
      <div className="usage-section">
        <h3>Daily Breakdown</h3>
        <div className="daily-list">
          {sortedDays.map(([day, data]) => (
            <div key={day} className="daily-item">
              <div className="daily-date">
                {new Date(day).toLocaleDateString(undefined, { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
              <div className="daily-stats">
                <span>{data.count} tasks</span>
                <span className="daily-cost">{fmt(data.cost)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By Model */}
      {Object.keys(summary.byModel || {}).length > 0 && (
        <div className="usage-section">
          <h3>By Model</h3>
          <div className="model-list">
            {Object.entries(summary.byModel || {}).map(([model, data]) => (
              <div key={model} className="model-item">
                <div className="model-name">{model}</div>
                <div className="model-stats">
                  <span>{fmtTokens(data.tokens)} tokens</span>
                  <span className="model-cost">{fmt(data.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Tasks */}
      <div className="usage-section">
        <h3>Recent Tasks</h3>
        <div className="task-list">
          {entries.slice(-10).reverse().map((entry, idx) => (
            <div key={idx} className="task-item">
              <div className="task-info">
                <span className="task-type-badge">{entry.taskType}</span>
                {entry.company && <span className="task-company">{entry.company}</span>}
                <span className="task-time">
                  {new Date(entry.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="task-cost">{fmt(entry.cost)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
