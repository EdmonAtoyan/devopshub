# AWS EC2 Deployment

This guide assumes a single Ubuntu-based EC2 instance running the web app, the API, and PostgreSQL on the same host. It keeps the browser-facing traffic on ports `80` and `443`, while the app itself runs on `127.0.0.1:3000` and `127.0.0.1:3001` behind Nginx.

## 1. Instance Prerequisites

- Ubuntu 22.04 or 24.04
- Node.js 20.x
- npm 10.x or newer
- PostgreSQL 16 or a compatible managed database
- Nginx

Recommended security group rules:

- allow `22` only from trusted admin IPs
- allow `80` from the internet
- allow `443` from the internet
- do not expose `3000` or `3001` publicly

## 2. Install System Packages

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. Prepare the App Directory

```bash
sudo mkdir -p /srv/devops-hub
sudo chown "$USER":"$USER" /srv/devops-hub
git clone <your-repository-url> /srv/devops-hub
cd /srv/devops-hub
npm ci
```

## 4. Create the Database

Example for a local PostgreSQL service:

```bash
sudo -u postgres psql
```

```sql
CREATE USER devopshub WITH PASSWORD 'change-me';
CREATE DATABASE devopshub OWNER devopshub;
\q
```

If you use Amazon RDS instead, update `DATABASE_URL` to point to the RDS endpoint and add `sslmode=require` when your cluster requires TLS.

## 5. Configure Environment Variables

Start from the provided template:

```bash
cp .env.example .env
```

Minimum production values to review:

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `RESET_PASSWORD_BASE_URL`
- `EMAIL_VERIFICATION_BASE_URL`
- `CORS_ORIGIN`
- `API_UPSTREAM_URL`
- `ALLOW_NGROK_ORIGINS`

Recommended production values:

```dotenv
DATABASE_URL="postgresql://devopshub:change-me@127.0.0.1:5432/devopshub?schema=public"
JWT_SECRET="replace-this-with-a-long-random-secret"
API_PORT="3001"
PORT="3000"
NEXT_PUBLIC_API_URL="/api"
API_UPSTREAM_URL="http://127.0.0.1:3001"
NEXT_PUBLIC_SITE_URL="https://community.example.com"
RESET_PASSWORD_BASE_URL="https://community.example.com"
EMAIL_VERIFICATION_BASE_URL="https://community.example.com"
CORS_ORIGIN="https://community.example.com"
ALLOW_NGROK_ORIGINS="false"
```

If you need email delivery, configure either the `SMTP_*` variables or `RESEND_API_KEY` plus `RESEND_FROM`.

## 6. Build the Application

```bash
npm run build
```

## 7. Run the App with systemd

Copy the sample unit from [deploy/systemd/devops-hub.service](../deploy/systemd/devops-hub.service) and adjust the `User`, `WorkingDirectory`, and `EnvironmentFile` paths if needed.

Install it:

```bash
sudo cp deploy/systemd/devops-hub.service /etc/systemd/system/devops-hub.service
sudo systemctl daemon-reload
sudo systemctl enable --now devops-hub
sudo systemctl status devops-hub
```

## 8. Configure Nginx

Copy the sample config from [deploy/nginx/devops-hub.conf](../deploy/nginx/devops-hub.conf), then set your real hostname.

Install it:

```bash
sudo cp deploy/nginx/devops-hub.conf /etc/nginx/sites-available/devops-hub
sudo ln -s /etc/nginx/sites-available/devops-hub /etc/nginx/sites-enabled/devops-hub
sudo nginx -t
sudo systemctl reload nginx
```

The sample config sends:

- `/` to the Next.js web server on `127.0.0.1:3000`
- `/api/` to the Nest API on `127.0.0.1:3001`
- `/uploads/` to the Nest API on `127.0.0.1:3001`
- `/socket.io/` to the Nest API on `127.0.0.1:3001` with websocket headers

## 9. Health Checks

Run these on the instance after the service starts:

```bash
curl -I http://127.0.0.1:3000
curl http://127.0.0.1:3001/api/health
curl -I http://127.0.0.1
```

Expected results:

- the web server responds on `127.0.0.1:3000`
- the API returns `{"status":"ok"}` from `/api/health`
- Nginx serves the site on port `80`

## 10. HTTPS

After the HTTP path works, add TLS with Certbot or your preferred certificate manager and update:

- `NEXT_PUBLIC_SITE_URL`
- `RESET_PASSWORD_BASE_URL`
- `EMAIL_VERIFICATION_BASE_URL`
- `CORS_ORIGIN`

to the final `https://` domain.
