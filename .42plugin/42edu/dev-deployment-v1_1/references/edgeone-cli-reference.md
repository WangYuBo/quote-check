# EdgeOne CLI Reference

## Command Structure

```
edgeone
├── login          # User login
├── logout         # User logout
├── whoami         # Get user info
├── switch         # Switch user
└── pages          # Pages functions
    ├── init       # Initialize project
    ├── dev        # Local development
    ├── env        # Environment variables
    │   └── pull   # Pull env vars
    ├── link       # Link project
    └── deploy     # Deploy project
```

## User Management

### Login
```bash
edgeone login
```
Interactive login, saves credentials locally.

### Logout
```bash
edgeone logout
```

### Check Status
```bash
edgeone whoami
```

### Switch Account
```bash
edgeone switch
```

## Pages Commands

### Initialize Project
```bash
edgeone pages init
```
Options:
- `-t, --token <token>` - API Token for CI/CD

### Local Development
```bash
edgeone pages dev
```
Options:
- `--debug` - Debug mode (default: false)
- `--port <port>` - Custom port
- `-t, --token <token>` - API Token

### Environment Variables

Pull from cloud:
```bash
edgeone pages env pull
```

### Link Project
```bash
edgeone pages link
```
Links local project to EdgeOne Pages project for better debugging.

### Deploy

```bash
edgeone pages deploy [directoryOrZip]
```

Options:
- `-n, --name <name>` - Project name
- `-t, --token <token>` - API Token
- `-e, --env <env>` - Environment: `production` | `preview` (default: production)
- `-a, --area <area>` - Region: `global` | `overseas` (default: global)

Examples:
```bash
# Deploy current directory to production
edgeone pages deploy

# Deploy ./out to production, overseas region
edgeone pages deploy ./out -n my-project -a overseas

# Deploy to preview environment
edgeone pages deploy --env preview

# CI/CD deployment with token
edgeone pages deploy -n my-project -t $EDGEONE_API_TOKEN
```

## Typical Workflows

### First-time Setup
```bash
edgeone login
edgeone whoami
edgeone pages init
edgeone pages link  # optional
```

### Local Development
```bash
edgeone pages env pull
edgeone pages dev
edgeone pages dev --port 3001 --debug
```

### Deployment
```bash
# Preview first
edgeone pages deploy --env preview

# Then production
edgeone pages deploy --env production

# Overseas region
edgeone pages deploy --area overseas

# Specific directory
edgeone pages deploy ./dist -n my-project
```

### CI/CD
```bash
edgeone pages deploy --token $EDGEONE_TOKEN -n my-project --env production
```

## Important Notes

1. Most commands require `edgeone login` first
2. Use `--token` for CI/CD instead of interactive login
3. `deploy` requires direct upload type project
4. Choose region based on target audience:
   - `global` - Includes China, some overseas APIs may be blocked
   - `overseas` - International nodes only
5. Test in preview environment before production
