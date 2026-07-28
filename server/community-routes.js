import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { query, transaction } from './db.js'
import { requireModerator, requireUser } from './security.js'
import {
  asyncRoute,
  excerptFrom,
  idSchema,
  parseBody,
  slugify,
  toComment,
  toPost,
  toPublicUser,
  uniqueSlug,
} from './utils.js'

const router = Router()

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You are posting too quickly. Pause for a moment.' },
})

router.use(writeLimiter)

const postSchema = z.object({
  kind: z.enum(['question', 'discussion', 'article']),
  title: z.string().trim().min(8).max(160),
  body: z.string().trim().min(30).max(40_000),
  tags: z.array(
    z.string().trim().min(1).max(30).transform((value) => value.toLowerCase()),
  ).max(5).default([]),
})

const commentSchema = z.object({
  body: z.string().trim().min(2).max(12_000),
  parentId: idSchema.nullish(),
})

const voteSchema = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) })
const reportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'unsafe', 'off_topic', 'other']),
  details: z.string().trim().max(500).default(''),
})

function postSelect(viewerParameter = '$1') {
  return `
    SELECT
      p.*,
      u.username, u.display_name, u.reputation,
      COALESCE((SELECT SUM(value)::INT FROM post_votes WHERE post_id = p.id), 0) AS score,
      (SELECT COUNT(*)::INT FROM comments WHERE post_id = p.id) AS comment_count,
      COALESCE((SELECT value FROM post_votes WHERE post_id = p.id AND user_id = ${viewerParameter}), 0) AS viewer_vote,
      EXISTS(SELECT 1 FROM bookmarks WHERE post_id = p.id AND user_id = ${viewerParameter}) AS bookmarked,
      COALESCE((
        SELECT JSON_AGG(JSON_BUILD_OBJECT('name', t.name, 'slug', t.slug) ORDER BY t.name)
        FROM post_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id = p.id
      ), '[]'::JSON) AS tags
    FROM posts p
    JOIN users u ON u.id = p.author_id
  `
}

router.get('/tags', asyncRoute(async (_request, response) => {
  const result = await query(
    `SELECT t.name, t.slug, t.description, COUNT(pt.post_id)::INT AS post_count
     FROM tags t
     LEFT JOIN post_tags pt ON pt.tag_id = t.id
     GROUP BY t.id
     ORDER BY post_count DESC, t.name
     LIMIT 80`,
  )
  response.json({ tags: result.rows.map((tag) => ({
    name: tag.name,
    slug: tag.slug,
    description: tag.description,
    postCount: tag.post_count,
  })) })
}))

router.get('/stats', asyncRoute(async (_request, response) => {
  const result = await query(
    `SELECT
       (SELECT COUNT(*)::INT FROM users) AS members,
       (SELECT COUNT(*)::INT FROM posts WHERE status <> 'archived') AS posts,
       (SELECT COUNT(*)::INT FROM comments) AS answers,
       (SELECT COUNT(*)::INT FROM posts WHERE status = 'solved') AS solved`,
  )
  response.json(result.rows[0])
}))

router.get('/posts', asyncRoute(async (request, response) => {
  const viewerId = request.user?.id ?? 0
  const kind = ['question', 'discussion', 'article'].includes(request.query.kind)
    ? request.query.kind
    : null
  const sort = ['newest', 'top', 'active', 'unanswered'].includes(request.query.sort)
    ? request.query.sort
    : 'active'
  const search = String(request.query.search ?? '').trim().slice(0, 100)
  const tag = String(request.query.tag ?? '').trim().slice(0, 60)
  const page = Math.max(1, Number.parseInt(request.query.page ?? '1', 10) || 1)
  const limit = 20
  const values = [viewerId]
  const where = [`p.status <> 'archived'`]

  if (kind) {
    values.push(kind)
    where.push(`p.kind = $${values.length}`)
  }
  if (search) {
    values.push(search)
    where.push(`(
      TO_TSVECTOR('english', p.title || ' ' || p.body)
        @@ WEBSEARCH_TO_TSQUERY('english', $${values.length})
      OR p.title % $${values.length}
    )`)
  }
  if (tag) {
    values.push(tag)
    where.push(`EXISTS (
      SELECT 1 FROM post_tags filter_pt
      JOIN tags filter_t ON filter_t.id = filter_pt.tag_id
      WHERE filter_pt.post_id = p.id AND filter_t.slug = $${values.length}
    )`)
  }
  if (sort === 'unanswered') {
    where.push(`p.kind = 'question' AND p.accepted_answer_id IS NULL`)
  }

  const order = {
    newest: 'p.created_at DESC',
    top: 'score DESC, p.created_at DESC',
    active: 'GREATEST(p.updated_at, p.created_at) DESC',
    unanswered: 'p.created_at DESC',
  }[sort]

  values.push(limit, (page - 1) * limit)
  const result = await query(
    `${postSelect()}
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )
  response.json({
    posts: result.rows.map(toPost),
    page,
    hasMore: result.rows.length === limit,
  })
}))

router.get('/posts/:slug', asyncRoute(async (request, response) => {
  const viewerId = request.user?.id ?? 0
  const result = await query(
    `${postSelect()}
     WHERE p.slug = $2 AND p.status <> 'archived'`,
    [viewerId, request.params.slug],
  )
  if (!result.rows[0]) return response.status(404).json({ error: 'Post not found.' })

  const post = toPost(result.rows[0])
  const comments = await query(
    `SELECT
       c.*,
       u.username, u.display_name, u.reputation,
       COALESCE((SELECT SUM(value)::INT FROM comment_votes WHERE comment_id = c.id), 0) AS score,
       COALESCE((SELECT value FROM comment_votes WHERE comment_id = c.id AND user_id = $1), 0) AS viewer_vote,
       (c.id = $3) AS accepted
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.post_id = $2
     ORDER BY accepted DESC, score DESC, c.created_at`,
    [viewerId, post.id, post.acceptedAnswerId ?? 0],
  )
  await query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [post.id])
  post.viewCount += 1
  response.json({ post, comments: comments.rows.map(toComment) })
}))

router.post('/posts', requireUser, asyncRoute(async (request, response) => {
  const body = parseBody(postSchema, request, response)
  if (!body) return

  const post = await transaction(async (client) => {
    const created = await client.query(
      `INSERT INTO posts (author_id, kind, title, slug, excerpt, body)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        request.user.id,
        body.kind,
        body.title,
        uniqueSlug(body.title),
        excerptFrom(body.body),
        body.body,
      ],
    )
    const row = created.rows[0]

    for (const tagName of [...new Set(body.tags)]) {
      const tagSlug = slugify(tagName).slice(0, 60)
      if (!tagSlug) continue
      const tag = await client.query(
        `INSERT INTO tags (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tagName, tagSlug],
      )
      await client.query(
        `INSERT INTO post_tags (post_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [row.id, tag.rows[0].id],
      )
    }
    return row
  })

  response.status(201).json({ id: Number(post.id), slug: post.slug })
}))

router.patch('/posts/:id', requireUser, asyncRoute(async (request, response) => {
  const id = idSchema.safeParse(request.params.id)
  const body = parseBody(postSchema, request, response)
  if (!id.success || !body) return response.status(400).json({ error: 'Invalid post.' })

  const existing = await query('SELECT author_id FROM posts WHERE id = $1', [id.data])
  if (!existing.rows[0]) return response.status(404).json({ error: 'Post not found.' })
  const canEdit = Number(existing.rows[0].author_id) === Number(request.user.id)
    || ['moderator', 'admin'].includes(request.user.role)
  if (!canEdit) return response.status(403).json({ error: 'You cannot edit this post.' })

  await transaction(async (client) => {
    await client.query(
      `UPDATE posts
       SET kind = $1, title = $2, excerpt = $3, body = $4, updated_at = NOW()
       WHERE id = $5`,
      [body.kind, body.title, excerptFrom(body.body), body.body, id.data],
    )
    await client.query('DELETE FROM post_tags WHERE post_id = $1', [id.data])
    for (const tagName of [...new Set(body.tags)]) {
      const tagSlug = slugify(tagName).slice(0, 60)
      if (!tagSlug) continue
      const tag = await client.query(
        `INSERT INTO tags (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tagName, tagSlug],
      )
      await client.query(
        'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id.data, tag.rows[0].id],
      )
    }
  })
  response.status(204).end()
}))

router.delete('/posts/:id', requireUser, asyncRoute(async (request, response) => {
  const id = idSchema.safeParse(request.params.id)
  if (!id.success) return response.status(400).json({ error: 'Invalid post.' })
  const result = await query('SELECT author_id FROM posts WHERE id = $1', [id.data])
  if (!result.rows[0]) return response.status(404).json({ error: 'Post not found.' })
  const canArchive = Number(result.rows[0].author_id) === Number(request.user.id)
    || ['moderator', 'admin'].includes(request.user.role)
  if (!canArchive) return response.status(403).json({ error: 'You cannot archive this post.' })
  await query(
    `UPDATE posts SET status = 'archived', updated_at = NOW() WHERE id = $1`,
    [id.data],
  )
  response.status(204).end()
}))

router.post('/posts/:id/comments', requireUser, asyncRoute(async (request, response) => {
  const postId = idSchema.safeParse(request.params.id)
  const body = parseBody(commentSchema, request, response)
  if (!postId.success || !body) return response.status(400).json({ error: 'Invalid answer.' })

  const comment = await transaction(async (client) => {
    const postResult = await client.query(
      `SELECT id, author_id, title FROM posts
       WHERE id = $1 AND status <> 'archived'
       FOR SHARE`,
      [postId.data],
    )
    const post = postResult.rows[0]
    if (!post) {
      const error = new Error('Post not found.')
      error.status = 404
      throw error
    }
    if (body.parentId) {
      const parent = await client.query(
        'SELECT id FROM comments WHERE id = $1 AND post_id = $2',
        [body.parentId, postId.data],
      )
      if (!parent.rows[0]) {
        const error = new Error('Reply target does not belong to this post.')
        error.status = 400
        throw error
      }
    }
    const created = await client.query(
      `INSERT INTO comments (post_id, author_id, parent_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId.data, request.user.id, body.parentId ?? null, body.body],
    )
    await client.query(
      'UPDATE posts SET updated_at = NOW() WHERE id = $1',
      [postId.data],
    )
    if (Number(post.author_id) !== Number(request.user.id)) {
      await client.query(
        `INSERT INTO notifications
           (user_id, actor_id, post_id, comment_id, kind, message)
         VALUES ($1, $2, $3, $4, 'answer', $5)`,
        [
          post.author_id,
          request.user.id,
          post.id,
          created.rows[0].id,
          `${request.user.display_name} replied to "${post.title}".`,
        ],
      )
    }
    return created.rows[0]
  })
  response.status(201).json({ id: Number(comment.id) })
}))

router.post('/posts/:id/vote', requireUser, asyncRoute(async (request, response) => {
  const postId = idSchema.safeParse(request.params.id)
  const body = parseBody(voteSchema, request, response)
  if (!postId.success || !body) return response.status(400).json({ error: 'Invalid vote.' })

  await transaction(async (client) => {
    const post = await client.query(
      'SELECT author_id FROM posts WHERE id = $1 FOR UPDATE',
      [postId.data],
    )
    if (!post.rows[0]) {
      const error = new Error('Post not found.')
      error.status = 404
      throw error
    }
    if (Number(post.rows[0].author_id) === Number(request.user.id)) {
      const error = new Error('You cannot vote on your own post.')
      error.status = 400
      throw error
    }
    const previous = await client.query(
      'SELECT value FROM post_votes WHERE post_id = $1 AND user_id = $2',
      [postId.data, request.user.id],
    )
    const previousValue = previous.rows[0]?.value ?? 0

    if (body.value === 0) {
      await client.query(
        'DELETE FROM post_votes WHERE post_id = $1 AND user_id = $2',
        [postId.data, request.user.id],
      )
    } else {
      await client.query(
        `INSERT INTO post_votes (post_id, user_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (post_id, user_id)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [postId.data, request.user.id, body.value],
      )
    }
    await client.query(
      'UPDATE users SET reputation = GREATEST(0, reputation + $1) WHERE id = $2',
      [body.value - previousValue, post.rows[0].author_id],
    )
  })
  response.status(204).end()
}))

router.post('/comments/:id/vote', requireUser, asyncRoute(async (request, response) => {
  const commentId = idSchema.safeParse(request.params.id)
  const body = parseBody(voteSchema, request, response)
  if (!commentId.success || !body) return response.status(400).json({ error: 'Invalid vote.' })

  await transaction(async (client) => {
    const comment = await client.query(
      'SELECT author_id FROM comments WHERE id = $1 FOR UPDATE',
      [commentId.data],
    )
    if (!comment.rows[0]) {
      const error = new Error('Answer not found.')
      error.status = 404
      throw error
    }
    if (Number(comment.rows[0].author_id) === Number(request.user.id)) {
      const error = new Error('You cannot vote on your own response.')
      error.status = 400
      throw error
    }
    const previous = await client.query(
      'SELECT value FROM comment_votes WHERE comment_id = $1 AND user_id = $2',
      [commentId.data, request.user.id],
    )
    const previousValue = previous.rows[0]?.value ?? 0
    if (body.value === 0) {
      await client.query(
        'DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2',
        [commentId.data, request.user.id],
      )
    } else {
      await client.query(
        `INSERT INTO comment_votes (comment_id, user_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (comment_id, user_id)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [commentId.data, request.user.id, body.value],
      )
    }
    await client.query(
      'UPDATE users SET reputation = GREATEST(0, reputation + $1) WHERE id = $2',
      [body.value - previousValue, comment.rows[0].author_id],
    )
  })
  response.status(204).end()
}))

router.post('/posts/:id/bookmark', requireUser, asyncRoute(async (request, response) => {
  const postId = idSchema.safeParse(request.params.id)
  if (!postId.success) return response.status(400).json({ error: 'Invalid post.' })
  const existing = await query(
    'SELECT 1 FROM bookmarks WHERE post_id = $1 AND user_id = $2',
    [postId.data, request.user.id],
  )
  if (existing.rows[0]) {
    await query(
      'DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2',
      [postId.data, request.user.id],
    )
    return response.json({ bookmarked: false })
  }
  await query(
    'INSERT INTO bookmarks (post_id, user_id) VALUES ($1, $2)',
    [postId.data, request.user.id],
  )
  response.json({ bookmarked: true })
}))

router.post('/posts/:postId/accept/:commentId', requireUser, asyncRoute(async (request, response) => {
  const postId = idSchema.safeParse(request.params.postId)
  const commentId = idSchema.safeParse(request.params.commentId)
  if (!postId.success || !commentId.success) {
    return response.status(400).json({ error: 'Invalid solution.' })
  }

  await transaction(async (client) => {
    const post = await client.query(
      `SELECT author_id, kind, accepted_answer_id, title
       FROM posts WHERE id = $1 FOR UPDATE`,
      [postId.data],
    )
    if (!post.rows[0]) {
      const error = new Error('Post not found.')
      error.status = 404
      throw error
    }
    const allowed = Number(post.rows[0].author_id) === Number(request.user.id)
      || ['moderator', 'admin'].includes(request.user.role)
    if (!allowed || post.rows[0].kind !== 'question') {
      const error = new Error('Only the question author can accept a solution.')
      error.status = 403
      throw error
    }
    const comment = await client.query(
      'SELECT author_id FROM comments WHERE id = $1 AND post_id = $2',
      [commentId.data, postId.data],
    )
    if (!comment.rows[0]) {
      const error = new Error('Answer not found.')
      error.status = 404
      throw error
    }
    const previousAnswerId = post.rows[0].accepted_answer_id
      ? Number(post.rows[0].accepted_answer_id)
      : null
    if (previousAnswerId === commentId.data) return

    if (previousAnswerId) {
      const previous = await client.query(
        'SELECT author_id FROM comments WHERE id = $1',
        [previousAnswerId],
      )
      if (previous.rows[0]) {
        await client.query(
          'UPDATE users SET reputation = GREATEST(0, reputation - 15) WHERE id = $1',
          [previous.rows[0].author_id],
        )
      }
    }
    await client.query(
      `UPDATE posts
       SET accepted_answer_id = $1, status = 'solved', updated_at = NOW()
       WHERE id = $2`,
      [commentId.data, postId.data],
    )
    if (Number(comment.rows[0].author_id) !== Number(request.user.id)) {
      await client.query(
        'UPDATE users SET reputation = reputation + 15 WHERE id = $1',
        [comment.rows[0].author_id],
      )
      await client.query(
        `INSERT INTO notifications
           (user_id, actor_id, post_id, comment_id, kind, message)
         VALUES ($1, $2, $3, $4, 'accepted', $5)`,
        [
          comment.rows[0].author_id,
          request.user.id,
          postId.data,
          commentId.data,
          `Your answer to "${post.rows[0].title}" was accepted.`,
        ],
      )
    }
  })
  response.status(204).end()
}))

router.post('/posts/:id/report', requireUser, asyncRoute(async (request, response) => {
  const postId = idSchema.safeParse(request.params.id)
  const body = parseBody(reportSchema, request, response)
  if (!postId.success || !body) return response.status(400).json({ error: 'Invalid report.' })
  await query(
    `INSERT INTO reports (reporter_id, post_id, reason, details)
     VALUES ($1, $2, $3, $4)`,
    [request.user.id, postId.data, body.reason, body.details],
  )
  response.status(201).json({ message: 'Report submitted for review.' })
}))

router.get('/notifications', requireUser, asyncRoute(async (request, response) => {
  const result = await query(
    `SELECT n.*, u.username AS actor_username
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 40`,
    [request.user.id],
  )
  response.json({
    notifications: result.rows.map((item) => ({
      id: Number(item.id),
      kind: item.kind,
      message: item.message,
      postId: item.post_id ? Number(item.post_id) : null,
      commentId: item.comment_id ? Number(item.comment_id) : null,
      actorUsername: item.actor_username,
      readAt: item.read_at,
      createdAt: item.created_at,
    })),
  })
}))

router.post('/notifications/read', requireUser, asyncRoute(async (request, response) => {
  await query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
    [request.user.id],
  )
  response.status(204).end()
}))

router.get('/users/:username', asyncRoute(async (request, response) => {
  const userResult = await query(
    `SELECT id, username, display_name, bio, location, website, role,
            reputation, created_at
     FROM users WHERE username = $1`,
    [request.params.username],
  )
  if (!userResult.rows[0]) return response.status(404).json({ error: 'Member not found.' })
  const user = toPublicUser(userResult.rows[0])
  const posts = await query(
    `${postSelect()}
     WHERE p.author_id = $2 AND p.status <> 'archived'
     ORDER BY p.created_at DESC
     LIMIT 30`,
    [request.user?.id ?? 0, user.id],
  )
  response.json({ user, posts: posts.rows.map(toPost) })
}))

router.get('/me/bookmarks', requireUser, asyncRoute(async (request, response) => {
  const result = await query(
    `${postSelect()}
     JOIN bookmarks viewer_bookmark
       ON viewer_bookmark.post_id = p.id AND viewer_bookmark.user_id = $1
     WHERE p.status <> 'archived'
     ORDER BY viewer_bookmark.created_at DESC`,
    [request.user.id],
  )
  response.json({ posts: result.rows.map(toPost) })
}))

router.get('/moderation/reports', requireModerator, asyncRoute(async (_request, response) => {
  const result = await query(
    `SELECT r.*, u.username AS reporter_username
     FROM reports r
     JOIN users u ON u.id = r.reporter_id
     WHERE r.status = 'open'
     ORDER BY r.created_at
     LIMIT 100`,
  )
  response.json({ reports: result.rows })
}))

export default router
