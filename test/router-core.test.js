import assert from 'node:assert/strict'
import test from 'node:test'
import { matchPath } from '../src/router-core.js'

test('route matching is exact and extracts decoded parameters', () => {
  assert.deepEqual(matchPath('/p/:slug', '/p/llvm-arrays'), { slug: 'llvm-arrays' })
  assert.deepEqual(matchPath('/u/:username', '/u/Azora%20Dev'), { username: 'Azora Dev' })
  assert.equal(matchPath('/p/:slug', '/p/a/extra'), null)
  assert.equal(matchPath('/p/:slug', '/tags/a'), null)
})

test('malformed URL parameters fail closed and wildcard routes match', () => {
  assert.equal(matchPath('/p/:slug', '/p/%E0%A4%A'), null)
  assert.deepEqual(matchPath('*', '/anything/here'), {})
  assert.deepEqual(matchPath('/', '/'), {})
})
