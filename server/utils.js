import { randomBytes } from 'node:crypto'
import { z } from 'zod'

export const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next)
}

export const idSchema = z.coerce.number().int().positive()

export function parseBody(schema, request, response) {
  const parsed = schema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Invalid request.',
      issues: parsed.error.issues,
    })
    return null
  }
  return parsed.data
}

export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || 'post'
}

export const uniqueSlug = (title) =>
  `${slugify(title)}-${randomBytes(3).toString('hex')}`

export function excerptFrom(body) {
  return body
    .replace(/```[\s\S]*?```/g, ' code ')
    .replace(/[#>*_`[\]()~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280)
}

export function toPublicUser(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    location: row.location,
    website: row.website,
    role: row.role,
    reputation: row.reputation,
    createdAt: row.created_at,
  }
}

export function toPost(row) {
  return {
    id: Number(row.id),
    kind: row.kind,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    status: row.status,
    acceptedAnswerId: row.accepted_answer_id ? Number(row.accepted_answer_id) : null,
    viewCount: row.view_count,
    score: row.score,
    commentCount: row.comment_count,
    bookmarked: row.bookmarked,
    viewerVote: row.viewer_vote,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: Number(row.author_id),
      username: row.username,
      displayName: row.display_name,
      reputation: row.reputation,
    },
  }
}

export function toComment(row) {
  return {
    id: Number(row.id),
    postId: Number(row.post_id),
    parentId: row.parent_id ? Number(row.parent_id) : null,
    body: row.body,
    score: row.score,
    viewerVote: row.viewer_vote,
    accepted: row.accepted,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: Number(row.author_id),
      username: row.username,
      displayName: row.display_name,
      reputation: row.reputation,
    },
  }
}
