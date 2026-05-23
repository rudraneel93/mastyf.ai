# Cloud OAuth setup (Google + GitHub)

Free cloud sign-in requires OAuth apps and four Vercel environment variables. **Pro license validation does not need OAuth** — buyers only need `GUARDIAN_LICENSE_KEY` + `GUARDIAN_CONTROL_PLANE_URL`.

After OAuth, the default callback is `/post-login`, which redirects to the [MCP Guardian GitHub repo](https://github.com/rudraneel93/mcp-guardian). The optional **cloud console** (`/dashboard`) is for policy, API keys, and advanced SSO into a running self-hosted instance.

Production app: `https://mcp-guardian-cloud.vercel.app`

## 1. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID** → type **Web application**
3. **Authorized redirect URIs** (exact):

   ```text
   https://mcp-guardian-cloud.vercel.app/api/auth/callback/google
   ```

4. Copy **Client ID** → `AUTH_GOOGLE_ID`
5. Copy **Client secret** → `AUTH_GOOGLE_SECRET`

Configure **OAuth consent screen** (External) with your support email if prompted.

## 2. GitHub OAuth

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. **Homepage URL:** `https://mcp-guardian-cloud.vercel.app`
3. **Authorization callback URL** (exact):

   ```text
   https://mcp-guardian-cloud.vercel.app/api/auth/callback/github
   ```

4. Copy **Client ID** → `AUTH_GITHUB_ID`
5. Generate **Client secret** → `AUTH_GITHUB_SECRET`

## 3. Add to Vercel

Project **mcp-guardian-cloud** → **Settings** → **Environment Variables** → Production:

| Variable | Value |
|----------|--------|
| `AUTH_GOOGLE_ID` | From Google |
| `AUTH_GOOGLE_SECRET` | From Google |
| `AUTH_GITHUB_ID` | From GitHub |
| `AUTH_GITHUB_SECRET` | From GitHub |

Already required (should exist):

| Variable | Value |
|----------|--------|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://mcp-guardian-cloud.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` |
| `DATABASE_URL` | Neon connection string |

**Redeploy** production after adding OAuth vars.

### CLI

```bash
export VERCEL_TOKEN="your-token"
printf '%s' 'GOOGLE_CLIENT_ID' | npx vercel@48 env add AUTH_GOOGLE_ID production --force --token "$VERCEL_TOKEN" --scope rudraneel93-gmailcoms-projects
printf '%s' 'GOOGLE_CLIENT_SECRET' | npx vercel@48 env add AUTH_GOOGLE_SECRET production --force --token "$VERCEL_TOKEN" --scope rudraneel93-gmailcoms-projects
printf '%s' 'GITHUB_CLIENT_ID' | npx vercel@48 env add AUTH_GITHUB_ID production --force --token "$VERCEL_TOKEN" --scope rudraneel93-gmailcoms-projects
printf '%s' 'GITHUB_CLIENT_SECRET' | npx vercel@48 env add AUTH_GITHUB_SECRET production --force --token "$VERCEL_TOKEN" --scope rudraneel93-gmailcoms-projects
cd ~/Desktop/mcp-guardian && npx vercel@48 deploy --prod --yes --token "$VERCEL_TOKEN" --scope rudraneel93-gmailcoms-projects
```

## 4. Verify

1. Open `https://mcp-guardian-cloud.vercel.app/login`
2. **Continue with Google** / **GitHub** should redirect to the provider (not HTTP 400)
3. After consent → `https://github.com/rudraneel93/mcp-guardian` (via `/post-login`; org is provisioned in the background)
4. Optional: open `/dashboard` (**cloud console**) for policy and API keys

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| HTTP 400 on `/api/auth/signin/google` | Missing or wrong `AUTH_GOOGLE_*` on Vercel; redeploy |
| `redirect_uri_mismatch` | Callback URL must match exactly (https, no trailing slash) |
| GitHub “redirect uri is not valid” | Use callback URL above in OAuth app settings |
| Buttons missing on `/login` | No OAuth env vars set — follow §3 |
| Sign-in works but no org | Check `DATABASE_URL` and Vercel function logs |
