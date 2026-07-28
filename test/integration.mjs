import assert from 'node:assert/strict'

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3028'
const marker = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? {
        Origin: 'https://dev.azoralang.org',
        'X-Requested-With': 'azora-web',
      } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${data?.error}`)
  return {
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie,
  }
}

async function register(role) {
  return request('/auth/register', {
    method: 'POST',
    body: {
      email: `${role}-${marker}@example.test`,
      username: `${role}-${marker}`.slice(0, 30),
      displayName: `${role} integration`,
      password: `integration-${marker}-password`,
    },
  })
}

const health = await request('/health')
assert.equal(health.data.status, 'ok')

const author = await register('author')
const answerer = await register('answerer')
assert.equal(author.data.user.role, 'member')

const created = await request('/posts', {
  cookie: author.cookie,
  method: 'POST',
  body: {
    kind: 'question',
    title: `How should integration ${marker} work?`,
    body: 'This integration post verifies the real PostgreSQL-backed community workflow.',
    tags: ['integration', 'llvm'],
  },
})

const detail = await request(`/posts/${created.data.slug}`, { cookie: author.cookie })
assert.equal(detail.data.post.kind, 'question')
assert.equal(detail.data.post.tags.some((tag) => tag.slug === 'llvm'), true)

const answer = await request(`/posts/${detail.data.post.id}/comments`, {
  cookie: answerer.cookie,
  method: 'POST',
  body: { body: 'Use a transaction and verify the observable result end to end.' },
})

await request(`/posts/${detail.data.post.id}/vote`, {
  cookie: answerer.cookie,
  method: 'POST',
  body: { value: 1 },
})
await request(`/comments/${answer.data.id}/vote`, {
  cookie: author.cookie,
  method: 'POST',
  body: { value: 1 },
})
const bookmark = await request(`/posts/${detail.data.post.id}/bookmark`, {
  cookie: answerer.cookie,
  method: 'POST',
})
assert.equal(bookmark.data.bookmarked, true)

await request(`/posts/${detail.data.post.id}/accept/${answer.data.id}`, {
  cookie: author.cookie,
  method: 'POST',
})
await request(`/posts/${detail.data.post.id}/accept/${answer.data.id}`, {
  cookie: author.cookie,
  method: 'POST',
})

const solved = await request(`/posts/${created.data.slug}`, { cookie: answerer.cookie })
assert.equal(solved.data.post.status, 'solved')
assert.equal(solved.data.post.score, 1)
assert.equal(solved.data.comments[0].accepted, true)
assert.equal(solved.data.comments[0].score, 1)

const notifications = await request('/notifications', { cookie: answerer.cookie })
assert.equal(notifications.data.notifications.some((item) => item.kind === 'accepted'), true)

const bookmarks = await request('/me/bookmarks', { cookie: answerer.cookie })
assert.equal(bookmarks.data.posts.some((post) => post.id === detail.data.post.id), true)

const answererProfile = await request(`/users/${answerer.data.user.username}`)
assert.equal(answererProfile.data.user.reputation, 16)

console.log(`Integration workflow passed for ${created.data.slug}`)
