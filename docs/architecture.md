# Architecture Notes

## High-level

- `web` deployed as stateless Next.js service (or static + edge functions split)
- `api` deployed as stateless NestJS service
- PostgreSQL as source of truth
- Redis for caching/session/rate-limit store
- Meilisearch for indexed full-text search
- Websocket gateway for live notifications

## Data Domains

- Identity: `User`, auth credentials, profile metadata
- Social graph: `Follow`, `TagFollow`
- Content: `Post`, `Article`, `Snippet`, tags and comments
- Engagement: likes/bookmarks across posts and articles
- Discovery: `Tool`, tags, search index
- Alerts: `Notification`

## Suggested Next Engineering Milestones

1. Implement OAuth providers: GitHub, Google, GitLab
2. Add CSRF tokens + refresh/access token rotation
3. Add write endpoints for posts/articles/snippets with ownership checks
4. Implement Meilisearch indexer worker and async queue
5. Add observability stack (OpenTelemetry, Prometheus metrics, structured logs)
6. Add moderation rules and abuse/rate controls
