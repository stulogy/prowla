import React, { useState, useEffect } from 'react';
import { BookOpen, ExternalLink, Building2 } from 'lucide-react';

// Extract brief snippet from research notes
function extractSnippet(notes) {
  if (!notes) return 'No research available';
  
  // Try to get company overview
  const lines = notes.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('## 🏢 Company Overview')) {
      // Get next few non-empty lines
      const snippetLines = [];
      for (let j = i + 1; j < lines.length && snippetLines.length < 3; j++) {
        if (lines[j].trim() && !lines[j].startsWith('##')) {
          snippetLines.push(lines[j].replace(/\*\*/g, '').replace(/\*/g, ''));
        }
      }
      if (snippetLines.length > 0) {
        return snippetLines.join(' ').slice(0, 200) + '...';
      }
    }
  }
  
  // Fallback: first few lines
  return notes.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .slice(0, 2)
    .join(' ')
    .slice(0, 200) + '...';
}

// Extract funding info
function extractFunding(notes) {
  if (!notes) return null;
  
  const lines = notes.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('## 💰 Funding Details')) {
      for (let j = i + 1; j < i + 10; j++) {
        if (lines[j] && lines[j].includes('**Amount:**')) {
          return lines[j].replace('**Amount:**', '').trim();
        }
      }
    }
  }
  return null;
}

export default function ResearchLibrary({ apiUrl, onSelectJob }) {
  const [research, setResearch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, funding-scan, job-boards

  useEffect(() => {
    fetchResearch();
  }, []);

  const fetchResearch = async () => {
    try {
      const res = await fetch(`${apiUrl}/research`);
      const data = await res.json();
      setResearch(data);
    } catch (e) {
      console.error('Failed to fetch research:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredResearch = research.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'funding-scan') return item.source === 'Funding Scan';
    if (filter === 'job-boards') return item.source !== 'Funding Scan';
    return true;
  });

  if (loading) {
    return (
      <div className="research-library" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p>Loading research...</p>
      </div>
    );
  }

  if (research.length === 0) {
    return (
      <div className="research-library empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <BookOpen size={48} style={{ margin: '0 auto 20px', opacity: 0.3 }} />
        <h3>No Research Yet</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
          Company research will appear here once you use the "Research Company" button in job details.
        </p>
      </div>
    );
  }

  return (
    <div className="research-library">
      <div className="research-header">
        <h2>Research Library</h2>
        <p className="research-subtitle">
          {research.length} {research.length === 1 ? 'company' : 'companies'} researched
        </p>
      </div>

      <div className="research-filters" style={{ marginBottom: '24px' }}>
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({research.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'funding-scan' ? 'active' : ''}`}
          onClick={() => setFilter('funding-scan')}
        >
          Funding Scan ({research.filter(r => r.source === 'Funding Scan').length})
        </button>
        <button 
          className={`filter-btn ${filter === 'job-boards' ? 'active' : ''}`}
          onClick={() => setFilter('job-boards')}
        >
          Job Boards ({research.filter(r => r.source !== 'Funding Scan').length})
        </button>
      </div>

      <div className="research-grid">
        {filteredResearch.map(item => {
          const funding = extractFunding(item.notes);
          const snippet = extractSnippet(item.notes);

          return (
            <div 
              key={item.id} 
              className="research-card"
              onClick={() => onSelectJob(item.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="research-card-header">
                <div>
                  <h3 className="research-company-name">
                    <Building2 size={18} />
                    {item.company}
                  </h3>
                  <p className="research-role">{item.role}</p>
                </div>
                <span className={`priority-tag ${item.priority.replace(/[🔴🟡🟢\s]/g, '').toLowerCase()}`}>
                  {item.priority.replace(/[🔴🟡🟢\s]/g, '')}
                </span>
              </div>

              {funding && (
                <div className="funding-badge">
                  💰 {funding}
                </div>
              )}

              <p className="research-snippet">{snippet}</p>

              <div className="research-card-footer">
                <span className="research-source">{item.source}</span>
                <span className="research-status status-badge status-{item.status.toLowerCase().replace(/\s/g, '-')}">
                  {item.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
