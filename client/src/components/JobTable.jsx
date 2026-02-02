import React from 'react';
import { ExternalLink, Trash2, FileText, Filter, ArrowUpDown, Sparkles } from 'lucide-react';

export default function JobTable({ 
  jobs, 
  updateStatus, 
  deleteJob, 
  openApplyModal, 
  filter, 
  setFilter, 
  sortBy, 
  setSortBy, 
  isNewJob, 
  formatDate 
}) {
  const statuses = ['Not Started', 'Applied', 'Done', 'Interviewing', 'Offer', 'Rejected'];
  const priorities = ['High', 'Medium', 'Lower'];

  // Helper to get clean priority text
  const getPriorityDisplay = (priority) => {
    if (!priority) return 'Medium';
    return priority.replace(/[🔴🟡🟢\s]/g, '').trim() || 'Medium';
  };

  return (
    <div className="table-container">
      <div className="table-header-controls">
        <div className="filters-row">
          <div className="filter-item">
            <Filter size={14} />
            <select 
              value={filter.status} 
              onChange={(e) => setFilter({...filter, status: e.target.value})}
            >
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div className="filter-item">
            <select 
              value={filter.priority} 
              onChange={(e) => setFilter({...filter, priority: e.target.value})}
            >
              <option value="">All Priorities</option>
              <option value="🔴 High">High</option>
              <option value="🟡 Medium">Medium</option>
              <option value="🟢 Lower">Lower</option>
            </select>
          </div>

          <label className="toggle-filter">
            <input
              type="checkbox"
              checked={filter.onlyNew}
              onChange={(e) => setFilter({...filter, onlyNew: e.target.checked})}
            />
            <Sparkles size={14} />
            <span>New Only</span>
          </label>
        </div>

        <div className="sort-controls">
          <ArrowUpDown size={14} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="priority">Priority</option>
            <option value="company">Company</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Company & Role</th>
              <th>Details</th>
              <th>Materials</th>
              <th>Priority</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className={`job-row ${isNewJob(job) ? 'is-new' : ''}`}>
                <td className="status-cell">
                  <select 
                    value={job.status} 
                    onChange={(e) => updateStatus(job.id, e.target.value)}
                    className={`status-badge status-${job.status.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="company-cell">
                  <div className="company-info">
                    <span className="company-name">
                      {job.company}
                      {isNewJob(job) && <span className="new-tag">New</span>}
                    </span>
                    <span className="job-role">{job.role}</span>
                  </div>
                </td>
                <td className="details-cell">
                  <div className="detail-badges">
                    <span className="badge badge-type">{job.type}</span>
                    <span className="badge badge-comp">{job.compensation}</span>
                    <span className="badge badge-source">{job.source}</span>
                  </div>
                </td>
                <td className="materials-cell">
                  <span className="materials-badge">{job.materials || '⬜ None'}</span>
                </td>
                <td className="priority-cell">
                  <span className={`priority-tag ${getPriorityDisplay(job.priority).toLowerCase()}`}>
                    {getPriorityDisplay(job.priority)}
                  </span>
                </td>
                <td className="date-cell">
                  {formatDate(job.created_at)}
                </td>
                <td className="actions-cell">
                  <button onClick={() => openApplyModal(job)} className="action-btn" title="View Details & Apply">
                    <FileText size={16} />
                  </button>
                  {job.apply_url && (
                    <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="action-btn" title="Open Link">
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button onClick={() => deleteJob(job.id)} className="action-btn delete" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {jobs.length === 0 && (
          <div className="empty-state">
            <p>No jobs found matching your filters.</p>
            <button onClick={() => { setFilter({ status: '', priority: '', source: '', onlyNew: false }); setSortBy('newest'); }}>
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
