import assert from 'node:assert/strict'
import test from 'node:test'
import { excerptFrom, slugify, uniqueSlug } from '../server/utils.js'

test('slugify normalizes human titles without hardcoded topic rules', () => {
  assert.equal(slugify('  LLVM: Arrays & Maps!  '), 'llvm-arrays-maps')
  assert.equal(slugify('Șir și memorie'), 'sir-si-memorie')
  assert.equal(slugify('---'), 'post')
})

test('unique slugs preserve the title prefix and add entropy', () => {
  const first = uniqueSlug('Compiler question')
  const second = uniqueSlug('Compiler question')
  assert.match(first, /^compiler-question-[a-f0-9]{6}$/)
  assert.notEqual(first, second)
})

test('excerpts remove markdown noise and fenced code', () => {
  const excerpt = excerptFrom('# Heading\n\n```azora\ntrace { "secret" }\n```\n**Useful** answer.')
  assert.equal(excerpt, 'Heading code Useful answer.')
})
