import React, { useState } from 'react';
import { X, ExternalLink, Download, Mail, CheckCircle, FileText } from 'lucide-react';

// Extract a specific section from research notes
function extractResearchSection(notesText, sectionHeader) {
  if (!notesText) return null;
  
  const lines = notesText.split('\n');
  const sectionLines = [];
  let inSection = false;
  
  for (let line of lines) {
    if (line.startsWith(sectionHeader)) {
      inSection = true;
      continue;
    }
    
    // Stop at next section
    if (inSection && line.startsWith('##')) {
      break;
    }
    
    if (inSection && line.trim()) {
      sectionLines.push(line);
    }
  }
  
  if (sectionLines.length === 0) {
    return <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No data available</p>;
  }
  
  return <div className="markdown-content">{renderMarkdown(sectionLines.join('\n'))}</div>;
}

// Extract funding context from notes
function extractFundingContext(notesText) {
  if (!notesText) return null;
  
  const lines = notesText.split('\n');
  const context = {
    howFound: null,
    funding: null,
    company: null,
    whyGoodFit: []
  };
  
  let currentSection = null;
  
  lines.forEach(line => {
    // Detect sections
    if (line.includes('## 🔍 How Found')) currentSection = 'howFound';
    else if (line.includes('## 💰 Funding Details')) currentSection = 'funding';
    else if (line.includes('## 🏢 Company Overview')) currentSection = 'company';
    else if (line.includes('## 🎯 Why This Is A Good Fit')) currentSection = 'whyGoodFit';
    else if (line.startsWith('##')) currentSection = null;
    
    // Extract data
    if (currentSection === 'howFound' && line.startsWith('**Source:**')) {
      context.howFound = line.replace('**Source:**', '').trim();
    }
    if (currentSection === 'funding') {
      if (line.startsWith('**Amount:**')) {
        context.funding = line.replace('**Amount:**', '').trim();
      }
      if (line.startsWith('**Lead investor:**')) {
        const investor = line.replace('**Lead investor:**', '').trim();
        context.funding += ` (${investor})`;
      }
    }
    if (currentSection === 'company' && line.startsWith('**What they do:**')) {
      context.company = line.replace('**What they do:**', '').trim();
    }
    if (currentSection === 'whyGoodFit' && line.startsWith('- ')) {
      context.whyGoodFit.push(line.replace('- ', '').trim());
    }
  });
  
  return (
    <div>
      {context.funding && (
        <div style={{ marginBottom: '10px' }}>
          <strong style={{ color: 'var(--accent-color)' }}>💰 Funding:</strong> {context.funding}
        </div>
      )}
      {context.company && (
        <div style={{ marginBottom: '10px' }}>
          <strong style={{ color: 'var(--accent-color)' }}>🏢 What they do:</strong> {context.company}
        </div>
      )}
      {context.howFound && (
        <div style={{ marginBottom: '10px', fontSize: '12px', opacity: '0.8' }}>
          <strong>Found via:</strong> {context.howFound}
        </div>
      )}
      {context.whyGoodFit.length > 0 && (
        <details style={{ marginTop: '12px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>
            Why this is a good fit ({context.whyGoodFit.length} reasons)
          </summary>
          <ul style={{ marginTop: '8px', marginLeft: '20px', fontSize: '12px', opacity: '0.9' }}>
            {context.whyGoodFit.map((reason, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>{reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// Simple markdown renderer
function renderMarkdown(text) {
  if (!text) return null;
  
  // Split into lines and process
  const lines = text.split('\n');
  const elements = [];
  let currentParagraph = [];
  
  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      elements.push(
        <p key={elements.length}>
          {processInlineMarkdown(currentParagraph.join(' '))}
        </p>
      );
      currentParagraph = [];
    }
  };
  
  lines.forEach((line, idx) => {
    // Headers
    if (line.startsWith('# ')) {
      flushParagraph();
      elements.push(<h1 key={idx}>{processInlineMarkdown(line.slice(2))}</h1>);
    } else if (line.startsWith('## ')) {
      flushParagraph();
      elements.push(<h2 key={idx}>{processInlineMarkdown(line.slice(3))}</h2>);
    } else if (line.startsWith('### ')) {
      flushParagraph();
      elements.push(<h3 key={idx}>{processInlineMarkdown(line.slice(4))}</h3>);
    }
    // Horizontal rule
    else if (line.trim() === '---' || line.trim() === '***') {
      flushParagraph();
      elements.push(<hr key={idx} />);
    }
    // List items
    else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      flushParagraph();
      elements.push(
        <li key={idx}>{processInlineMarkdown(line.trim().slice(2))}</li>
      );
    }
    // Empty line
    else if (line.trim() === '') {
      flushParagraph();
    }
    // Regular text
    else {
      currentParagraph.push(line);
    }
  });
  
  flushParagraph();
  
  // Wrap consecutive li elements in ul
  const wrappedElements = [];
  let listItems = [];
  
  elements.forEach((el, idx) => {
    if (el.type === 'li') {
      listItems.push(el);
    } else {
      if (listItems.length > 0) {
        wrappedElements.push(<ul key={`ul-${idx}`}>{listItems}</ul>);
        listItems = [];
      }
      wrappedElements.push(el);
    }
  });
  
  if (listItems.length > 0) {
    wrappedElements.push(<ul key="ul-final">{listItems}</ul>);
  }
  
  return wrappedElements;
}

function processInlineMarkdown(text) {
  if (!text) return text;
  
  // Process bold **text** or __text__
  const parts = [];
  let remaining = text;
  let key = 0;
  
  while (remaining.length > 0) {
    // Look for **bold** pattern
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    
    if (boldMatch) {
      const beforeBold = remaining.slice(0, boldMatch.index);
      if (beforeBold) {
        parts.push(processLinks(beforeBold, key++));
      }
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(processLinks(remaining, key++));
      break;
    }
  }
  
  return parts;
}

function processLinks(text, key) {
  // Process [text](url) links first
  const linkMatch = text.match(/\[(.+?)\]\((.+?)\)/);
  
  if (linkMatch) {
    const parts = [];
    const beforeLink = text.slice(0, linkMatch.index);
    if (beforeLink) parts.push(processEmails(beforeLink, `${key}-before`));
    parts.push(
      <a key={`link-${key}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
        {linkMatch[1]}
      </a>
    );
    const afterLink = text.slice(linkMatch.index + linkMatch[0].length);
    if (afterLink) parts.push(processEmails(afterLink, `${key}-after`));
    return parts;
  }
  
  // Process email addresses if no markdown links
  return processEmails(text, key);
}

function processEmails(text, key) {
  // Match email addresses (simple pattern)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = [...text.matchAll(emailRegex)];
  
  if (matches.length === 0) return text;
  
  const parts = [];
  let lastIndex = 0;
  
  matches.forEach((match, idx) => {
    // Add text before email
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add email as mailto link
    parts.push(
      <a 
        key={`email-${key}-${idx}`} 
        href={`mailto:${match[0]}`}
        style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}
        title={`Send email to ${match[0]}`}
      >
        {match[0]}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}

export default function JobModal({ modalData, onClose, onMarkApplied, apiUrl, addNotification }) {
  const { job, coverLetter, coverLetterPdf, email, notes } = modalData;
  const [activeTab, setActiveTab] = useState('details');
  const [researchLoading, setResearchLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  if (!job) return null;

  const handleRequestResearch = async () => {
    setResearchLoading(true);
    try {
      const res = await fetch(`${apiUrl}/jobs/${job.id}/request-research`, {
        method: 'POST'
      });
      if (res.ok) {
        if (addNotification) {
          addNotification(`Research task queued for ${job.company}`, 'success');
        }
      } else {
        if (addNotification) {
          addNotification('Failed to queue research task', 'error');
        }
      }
    } catch (e) {
      if (addNotification) {
        addNotification('Error: ' + e.message, 'error');
      }
    } finally {
      setResearchLoading(false);
    }
  };

  const handleRequestMaterials = async () => {
    setMaterialsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/jobs/${job.id}/request-materials`, {
        method: 'POST'
      });
      if (res.ok) {
        if (addNotification) {
          addNotification(`Materials generation queued for ${job.company}`, 'success');
        }
      } else {
        if (addNotification) {
          addNotification('Failed to queue materials generation', 'error');
        }
      }
    } catch (e) {
      if (addNotification) {
        addNotification('Error: ' + e.message, 'error');
      }
    } finally {
      setMaterialsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{job.company}</h2>
            <p className="modal-subtitle">{job.role} • {job.type}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Job Details
          </button>
          <button 
            className={`tab-btn ${activeTab === 'research' ? 'active' : ''}`}
            onClick={() => setActiveTab('research')}
          >
            🔍 Research
          </button>
          <button 
            className={`tab-btn ${activeTab === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveTab('materials')}
          >
            Application Materials
          </button>
          <button 
            className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            Notes
          </button>
        </div>

        <div className="modal-content">
          {activeTab === 'details' && (
            <div className="tab-pane">
              <div className="info-grid">
                <div className="info-item">
                  <label>Location</label>
                  <span>{job.location || 'Remote / Unspecified'}</span>
                </div>
                <div className="info-item">
                  <label>Compensation</label>
                  <span>{job.compensation || 'TBD'}</span>
                </div>
                <div className="info-item">
                  <label>Source</label>
                  <span>{job.source}</span>
                </div>
                <div className="info-item">
                  <label>Date Added</label>
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="actions-section">
                <h3>Application Actions</h3>
                <div className="action-buttons">
                  {job.apply_url ? (
                    <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                      <ExternalLink size={16} />
                      Open Application
                    </a>
                  ) : (
                    <div className="no-link-msg">No direct link available</div>
                  )}
                  
                  {email && (
                    <button 
                      className="btn btn-secondary"
                      onClick={() => window.open(`mailto:?subject=Application: ${job.role} at ${job.company}&body=${encodeURIComponent(email)}`)}
                    >
                      <Mail size={16} />
                      Draft Email
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="tab-pane">
              {!coverLetter && !email && !coverLetterPdf ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                    No application materials generated yet.
                  </p>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleRequestMaterials}
                    disabled={materialsLoading}
                  >
                    {materialsLoading ? '⏳ Queuing...' : '✨ Generate Materials'}
                  </button>
                  <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    Clawd will research the company and write a personalized cover letter & email
                  </p>
                </div>
              ) : (
                <>
                  {coverLetterPdf && (
                    <a 
                      href={`${apiUrl.replace('/api', '')}/applications/${job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/cover-letter.pdf`}
                      target="_blank"
                      className="file-card"
                      download
                    >
                      <div className="file-icon">
                        <FileText size={24} />
                      </div>
                      <div className="file-info">
                        <span className="file-name">Cover Letter.pdf</span>
                        <span className="file-meta">Click to download</span>
                      </div>
                      <Download size={18} />
                    </a>
                  )}
                  
                  {coverLetter && (
                    <div className="text-preview">
                      <h4>Cover Letter</h4>
                      <div className="markdown-content">
                        {renderMarkdown(coverLetter)}
                      </div>
                    </div>
                  )}

                  {email && (
                    <div className="text-preview">
                      <h4>Outreach Email</h4>
                      <div className="markdown-content">
                        {renderMarkdown(email)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'research' && (
            <div className="tab-pane">
              <div className="research-content">
                {notes ? (
                  <>
                    <div className="research-section">
                      <h3 className="research-section-title">💰 Funding Details</h3>
                      {extractResearchSection(notes, '## 💰 Funding Details')}
                    </div>
                    
                    <div className="research-section">
                      <h3 className="research-section-title">🏢 Company Overview</h3>
                      {extractResearchSection(notes, '## 🏢 Company Overview')}
                    </div>
                    
                    <div className="research-section">
                      <h3 className="research-section-title">🔍 How We Found Them</h3>
                      {extractResearchSection(notes, '## 🔍 How Found')}
                    </div>
                    
                    <div className="research-section">
                      <h3 className="research-section-title">👥 Key Contacts</h3>
                      {extractResearchSection(notes, '## 👥 Founders / Key Contacts')}
                    </div>
                    
                    <div className="research-section">
                      <h3 className="research-section-title">🎯 Why This Is A Good Fit</h3>
                      {extractResearchSection(notes, '## 🎯 Why This Is A Good Fit')}
                    </div>
                    
                    <div className="research-section">
                      <h3 className="research-section-title">📝 Outreach Strategy</h3>
                      {extractResearchSection(notes, '## 📝 Outreach Strategy')}
                    </div>
                  </>
                ) : (
                  <div className="empty-state" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                      No company research available yet.
                    </p>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleRequestResearch}
                      disabled={researchLoading}
                    >
                      {researchLoading ? '⏳ Queuing...' : '🔍 Research Company'}
                    </button>
                    <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                      Clawd will research funding, team, product, and why this is a good fit
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="tab-pane">
              {(notes || job.notes) ? (
                <div className="text-preview">
                  <h4>Notes</h4>
                  <div className="markdown-content">
                    {renderMarkdown(notes || job.notes)}
                  </div>
                </div>
              ) : (
                <div className="empty-msg">No notes available</div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={onMarkApplied}>
            <CheckCircle size={18} />
            Mark as Applied
          </button>
        </div>
      </div>
    </div>
  );
}
