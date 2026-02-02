import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';

export default function Settings({ apiUrl, onClose, addNotification }) {
  const [settings, setSettings] = useState({
    workTypes: ['Fractional', 'Contract', 'Part-time'],
    hoursPerWeek: { min: 10, max: 30 },
    rates: {
      hourly: { min: 110, max: 170 },
      fractionalMonthly: { min: 5000, max: 8000 },
      fullTimeSalary: { min: 140000, max: 180000 }
    },
    industries: ['EdTech', 'SaaS', 'AI', 'B2B'],
    companyStages: ['Pre-seed', 'Seed', 'Series A'],
    mustBeRemote: true,
    autoRejectFullTime: true,
    noAgencies: true,
    searchFrequency: '8,16', // cron hours
    autoResearch: false,
    notifyOnNewJobs: true
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${apiUrl}/settings`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        if (addNotification) {
          addNotification('Settings saved successfully', 'success');
        }
        if (onClose) onClose();
      } else {
        if (addNotification) {
          addNotification('Failed to save settings', 'error');
        }
      }
    } catch (e) {
      if (addNotification) {
        addNotification('Error saving settings: ' + e.message, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkType = (type) => {
    setSettings(prev => ({
      ...prev,
      workTypes: prev.workTypes.includes(type)
        ? prev.workTypes.filter(t => t !== type)
        : [...prev.workTypes, type]
    }));
  };

  const toggleIndustry = (industry) => {
    setSettings(prev => ({
      ...prev,
      industries: prev.industries.includes(industry)
        ? prev.industries.filter(i => i !== industry)
        : [...prev.industries, industry]
    }));
  };

  const toggleCompanyStage = (stage) => {
    setSettings(prev => ({
      ...prev,
      companyStages: prev.companyStages.includes(stage)
        ? prev.companyStages.filter(s => s !== stage)
        : [...prev.companyStages, stage]
    }));
  };

  if (loading) {
    return (
      <div className="settings-overlay">
        <div className="settings-container">
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-container" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Job Search Settings</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
          
          {/* Work Types */}
          <div className="settings-section">
            <h3>Work Types</h3>
            <p className="settings-help">What types of roles are you looking for?</p>
            <div className="checkbox-group">
              {['Fractional', 'Contract', 'Part-time', 'Full-time'].map(type => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.workTypes.includes(type)}
                    onChange={() => toggleWorkType(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hours per Week */}
          <div className="settings-section">
            <h3>Hours per Week</h3>
            <div className="range-inputs">
              <div className="range-input">
                <label>Min</label>
                <input
                  type="number"
                  value={settings.hoursPerWeek.min}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    hoursPerWeek: { ...prev.hoursPerWeek, min: parseInt(e.target.value) }
                  }))}
                  min="0"
                  max="40"
                />
              </div>
              <span>—</span>
              <div className="range-input">
                <label>Max</label>
                <input
                  type="number"
                  value={settings.hoursPerWeek.max}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    hoursPerWeek: { ...prev.hoursPerWeek, max: parseInt(e.target.value) }
                  }))}
                  min="0"
                  max="40"
                />
              </div>
            </div>
          </div>

          {/* Rate Expectations */}
          <div className="settings-section">
            <h3>Rate Expectations</h3>
            
            <div className="rate-group">
              <label>Hourly Rate</label>
              <div className="range-inputs">
                <input
                  type="number"
                  value={settings.rates.hourly.min}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    rates: { ...prev.rates, hourly: { ...prev.rates.hourly, min: parseInt(e.target.value) } }
                  }))}
                  placeholder="Min"
                />
                <span>—</span>
                <input
                  type="number"
                  value={settings.rates.hourly.max}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    rates: { ...prev.rates, hourly: { ...prev.rates.hourly, max: parseInt(e.target.value) } }
                  }))}
                  placeholder="Max"
                />
                <span>/hr</span>
              </div>
            </div>

            <div className="rate-group">
              <label>Fractional Monthly</label>
              <div className="range-inputs">
                <input
                  type="number"
                  value={settings.rates.fractionalMonthly.min}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    rates: { ...prev.rates, fractionalMonthly: { ...prev.rates.fractionalMonthly, min: parseInt(e.target.value) } }
                  }))}
                  placeholder="Min"
                />
                <span>—</span>
                <input
                  type="number"
                  value={settings.rates.fractionalMonthly.max}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    rates: { ...prev.rates, fractionalMonthly: { ...prev.rates.fractionalMonthly, max: parseInt(e.target.value) } }
                  }))}
                  placeholder="Max"
                />
                <span>/mo</span>
              </div>
            </div>
          </div>

          {/* Industries */}
          <div className="settings-section">
            <h3>Industries</h3>
            <div className="checkbox-group">
              {['EdTech', 'SaaS', 'AI', 'B2B', 'FinTech', 'HealthTech'].map(industry => (
                <label key={industry} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.industries.includes(industry)}
                    onChange={() => toggleIndustry(industry)}
                  />
                  <span>{industry}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Company Stage */}
          <div className="settings-section">
            <h3>Company Stage</h3>
            <div className="checkbox-group">
              {['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth'].map(stage => (
                <label key={stage} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.companyStages.includes(stage)}
                    onChange={() => toggleCompanyStage(stage)}
                  />
                  <span>{stage}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="settings-section">
            <h3>Filters</h3>
            <div className="toggle-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.mustBeRemote}
                  onChange={(e) => setSettings(prev => ({ ...prev, mustBeRemote: e.target.checked }))}
                />
                <span>Must be Remote</span>
              </label>
              
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.autoRejectFullTime}
                  onChange={(e) => setSettings(prev => ({ ...prev, autoRejectFullTime: e.target.checked }))}
                />
                <span>Auto-reject Full-time roles</span>
              </label>
              
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.noAgencies}
                  onChange={(e) => setSettings(prev => ({ ...prev, noAgencies: e.target.checked }))}
                />
                <span>No agencies/consultancies</span>
              </label>
            </div>
          </div>

          {/* Automation */}
          <div className="settings-section">
            <h3>Automation</h3>
            
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.autoResearch}
                onChange={(e) => setSettings(prev => ({ ...prev, autoResearch: e.target.checked }))}
              />
              <span>Auto-research new jobs</span>
              <p className="settings-help">Automatically research companies when new jobs are added</p>
            </label>
            
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.notifyOnNewJobs}
                onChange={(e) => setSettings(prev => ({ ...prev, notifyOnNewJobs: e.target.checked }))}
              />
              <span>Notify on new jobs</span>
            </label>
          </div>

        </div>

        <div className="settings-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
