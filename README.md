# Azora Dev

Azora Dev is the database-backed community application for Azora developers. It
combines focused Q&A, engineering discussions, long-form blog posts, profiles,
tags, voting, accepted solutions, bookmarks, notifications, and moderation.
The canonical production address is `https://azora.dev`.

## Architecture

- React 19 and Vite for the browser application.
- Node.js 22 and Express 5 for the API and static application server.
- PostgreSQL 18 for accounts, sessions, content, votes, and moderation records.
- Server-side `scrypt` password hashing and opaque, hashed database sessions.
- Docker Compose for an isolated application and database network.
- Nginx and Let's Encrypt at the VPS edge.

The database is intentionally not published on a host port. Only the application
port is bound to `127.0.0.1`, where Nginx can reach it.

## Local development

Create a local environment file:

```sh
cp .env.example .env
```

Start the database and production-shaped application:

```sh
docker compose up --build
```

For the Vite development server, run PostgreSQL separately and then:

```sh
npm install
npm run dev
```

The Vite application is available at `http://127.0.0.1:5190`; the API listens on
`http://127.0.0.1:3028`.

## Verification

```sh
npm run check
npm run audit
BASE_URL=http://127.0.0.1:3028 node test/integration.mjs
```

The integration workflow creates two isolated test users and verifies a complete
question lifecycle against PostgreSQL: publish, answer, vote, bookmark, accept,
notify, and read.

## Production deployment

GitHub Actions builds and tests every push to `main`, uploads the source tree to
`/srv/azora-dev/app`, and calls the root-owned deployment command:

```text
/usr/local/sbin/deploy-azora-dev
```

The repository needs one GitHub Actions secret:

```text
AZORA_SSH_PRIVATE_KEY
```

It must contain the private deployment key corresponding to the public key
installed for the unprivileged `azora-deploy` VPS account. The account receives
passwordless sudo access only to the deployment command.

Production secrets live in `/srv/azora-dev/.env` on the server and are never
uploaded by CI. Required values are:

```dotenv
POSTGRES_DB=azora_dev
POSTGRES_USER=azora
POSTGRES_PASSWORD=<long-random-value>
SESSION_DAYS=30
```

## Backups and restore

`azora-dev-backup.timer` runs a custom-format PostgreSQL dump every day and
retains 14 days under `/srv/azora-dev/backups`.

To restore a selected backup:

```sh
cd /srv/azora-dev/app
docker compose exec -T postgres dropdb --username=azora azora_dev
docker compose exec -T postgres createdb --username=azora azora_dev
docker compose exec -T postgres pg_restore \
  --username=azora --dbname=azora_dev --no-owner \
  < /srv/azora-dev/backups/azora-dev-YYYYMMDDTHHMMSSZ.dump
docker compose restart app
```

Take a fresh backup immediately before a restore. Restores are destructive and
must be performed from the VPS console by an administrator.

## Security notes

- Passwords are never logged or stored in plaintext.
- Session cookies are `HttpOnly`, `Secure` in production, and `SameSite=Lax`.
- Session tokens are random and stored only as SHA-256 hashes.
- Mutations require a same-origin marker and pass an origin check.
- Authentication and write endpoints have separate rate limits.
- User-provided Markdown is rendered as React elements without raw HTML support.
- Helmet enforces the application Content Security Policy.
- The npm production dependency audit runs before every deployment.
