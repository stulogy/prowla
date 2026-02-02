# Configuration Guide

ProwlA uses three configuration files to customize your job search experience.

## Configuration Files

| File | Purpose |
|------|---------|
| `config/profile.json` | Your background, skills, and preferences |
| `config/search.json` | Job search criteria and filters |
| `config/scoring.json` | Priority scoring weights (optional) |
| `.env` | Environment variables and API keys |

## Profile Configuration

`config/profile.json` contains information about you that's used for:
- Generating personalized cover letters
- Writing tailored outreach emails
- Analyzing job fit

### Full Schema

```json
{
  "name": "Your Full Name",
  "email": "your.email@example.com",
  "title": "Your Professional Title",
  "location": "City, Country",
  
  "background": "A paragraph describing your professional background, experience, and what makes you unique. This is used to personalize cover letters and emails.",
  
  "skills": [
    "Primary Skill",
    "Secondary Skill",
    "Tool or Technology",
    "Soft Skill",
    "Domain Expertise"
  ],
  
  "highlights": [
    "Key achievement with measurable impact",
    "Notable project or accomplishment",
    "Award or recognition"
  ],
  
  "experience": {
    "years": 10,
    "industries": ["SaaS", "FinTech", "E-commerce"],
    "companyTypes": ["Startup", "Enterprise", "Agency", "Freelance"]
  },
  
  "portfolio": {
    "website": "https://yourwebsite.com",
    "linkedin": "https://linkedin.com/in/yourprofile",
    "github": "https://github.com/yourusername",
    "dribbble": "https://dribbble.com/yourprofile"
  },
  
  "preferences": {
    "tone": "professional | casual | friendly",
    "coverLetterStyle": "concise | detailed | storytelling",
    "highlightAchievements": true,
    "includeMetrics": true
  },
  
  "notes": "Additional context for AI to consider when generating materials."
}
```

### Required Fields

At minimum, include:
- `name`
- `title`
- `background`
- `skills` (at least 3)

### Example

```json
{
  "name": "Alex Chen",
  "title": "Senior Product Designer",
  "background": "I'm a product designer with 8 years of experience building consumer and B2B SaaS products. I specialize in design systems, user research, and turning complex problems into intuitive interfaces. Previously led design at two YC startups through Series B.",
  "skills": [
    "Product Design",
    "Design Systems",
    "User Research",
    "Figma",
    "Prototyping",
    "Cross-functional Leadership"
  ],
  "highlights": [
    "Led redesign that increased user activation by 45%",
    "Built design system serving 12 product teams",
    "Reduced support tickets 60% through UX improvements"
  ]
}
```

## Search Configuration

`config/search.json` defines what jobs you're looking for.

### Full Schema

```json
{
  "targetRoles": [
    "Primary Role Title",
    "Alternative Title",
    "Related Title"
  ],
  
  "keywords": [
    "keyword1",
    "keyword2"
  ],
  
  "excludeKeywords": [
    "junior",
    "intern",
    "entry level"
  ],
  
  "workTypes": [
    "Full-time",
    "Contract",
    "Fractional",
    "Part-time"
  ],
  
  "remote": {
    "required": true,
    "preferredTimezones": ["US/Pacific", "US/Eastern", "UTC"],
    "hybridOk": false,
    "relocationOk": false
  },
  
  "compensation": {
    "salary": {
      "min": 120000,
      "max": 200000,
      "currency": "USD"
    },
    "hourly": {
      "min": 75,
      "max": 150,
      "currency": "USD"
    },
    "fractionalMonthly": {
      "min": 4000,
      "max": 10000,
      "currency": "USD"
    }
  },
  
  "hoursPerWeek": {
    "min": 10,
    "max": 40
  },
  
  "industries": {
    "preferred": ["SaaS", "FinTech", "AI/ML"],
    "excluded": ["Gambling", "Tobacco"]
  },
  
  "companyStage": {
    "preferred": ["Seed", "Series A", "Series B"],
    "excluded": ["Pre-seed"]
  },
  
  "companySize": {
    "min": 5,
    "max": 500
  },
  
  "sources": [
    {
      "name": "LinkedIn",
      "url": "https://linkedin.com/jobs",
      "enabled": true,
      "searchUrl": "https://linkedin.com/jobs/search?keywords=..."
    }
  ],
  
  "autoResearch": {
    "enabled": false,
    "minPriorityScore": 85
  }
}
```

### Key Sections

#### Target Roles
List job titles you're looking for. The scoring system matches against these.

```json
{
  "targetRoles": [
    "Product Designer",
    "Senior Product Designer", 
    "Staff Product Designer",
    "UX Designer",
    "Design Lead"
  ]
}
```

#### Remote Preferences

```json
{
  "remote": {
    "required": true,
    "preferredTimezones": ["US/Pacific", "US/Eastern"],
    "hybridOk": false
  }
}
```

#### Compensation

Support multiple compensation structures:

```json
{
  "compensation": {
    "salary": { "min": 150000 },
    "hourly": { "min": 100, "max": 175 },
    "fractionalMonthly": { "min": 5000, "max": 8000 }
  }
}
```

#### Industries

```json
{
  "industries": {
    "preferred": ["SaaS", "FinTech", "EdTech", "HealthTech", "AI/ML", "B2B"],
    "excluded": ["Gambling", "Adult", "Tobacco", "Weapons"]
  }
}
```

#### Auto Research

Automatically queue research for high-priority jobs:

```json
{
  "autoResearch": {
    "enabled": true,
    "minPriorityScore": 85
  }
}
```

## Scoring Configuration

`config/scoring.json` (optional) customizes how jobs are prioritized.

### Default Weights

```json
{
  "weights": {
    "roleMatch": 25,
    "compensationMatch": 20,
    "industryMatch": 15,
    "companyStageMatch": 15,
    "remoteMatch": 10,
    "workTypeMatch": 10,
    "recencyBonus": 5
  }
}
```

### Priority Thresholds

```json
{
  "thresholds": {
    "highPriority": 85,
    "mediumPriority": 60,
    "lowPriority": 0
  }
}
```

Jobs scoring 85+ get 🔴 High priority, 60-84 get 🟡 Medium, below 60 get 🟢 Lower.

### Bonuses and Penalties

```json
{
  "bonuses": {
    "recentFunding": 10,
    "referral": 15,
    "directApplication": 5,
    "knownContact": 20
  },
  "penalties": {
    "noSalaryListed": -5,
    "vagueJobDescription": -10
  }
}
```

## Environment Variables

`.env` contains sensitive configuration and API keys.

### Required

```bash
# For AI-powered features (research, materials)
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional

```bash
# Server configuration
PORT=3001
NODE_ENV=development

# Autonomous mode
AUTONOMOUS_MODE=false
HEARTBEAT_INTERVAL=60000

# External APIs
APOLLO_API_KEY=       # Email finding
CRUNCHBASE_API_KEY=   # Funding data
```

## Configuration Loading

ProwlA loads configuration in this order:

1. Default values (built-in)
2. `config/*.json` files
3. Environment variables (`.env`)
4. Runtime overrides (via API/MCP)

Later sources override earlier ones.

## Validating Configuration

Check your configuration:

```bash
# Validate profile
node -e "console.log(JSON.parse(require('fs').readFileSync('config/profile.json')))"

# Validate search
node -e "console.log(JSON.parse(require('fs').readFileSync('config/search.json')))"
```

## Hot Reloading

Configuration changes are picked up:
- **Profile/Search**: On next API request
- **Scoring**: On next job evaluation
- **Environment**: Requires server restart

## Tips

### Start Simple

Begin with minimal configuration:

```json
// config/profile.json
{
  "name": "Your Name",
  "title": "Your Title",
  "background": "Brief background",
  "skills": ["Skill 1", "Skill 2", "Skill 3"]
}

// config/search.json
{
  "targetRoles": ["Your Target Role"],
  "remote": { "required": true }
}
```

### Iterate

Refine your configuration as you use ProwlA:
- Adjust scoring weights based on which jobs you actually apply to
- Add excluded keywords for roles you keep seeing but don't want
- Fine-tune compensation ranges based on market feedback

### Backup

Keep backups of working configurations:

```bash
cp config/profile.json config/profile.backup.json
```

## Next Steps

- [modes/MANUAL-MODE.md](modes/MANUAL-MODE.md) — Using without AI
- [modes/MCP-MODE.md](modes/MCP-MODE.md) — AI-assisted workflows
- [agents/MCP-REFERENCE.md](agents/MCP-REFERENCE.md) — MCP tool documentation
