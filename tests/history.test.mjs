import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHistoryService, MAX_HISTORY } from '../src/services/history/historyService.js'

/** In-memory stand-in for localStorage. */
function fakeStorage(seed = []) {
  let value = seed
  return {
    reads: 0,
    writes: 0,
    persistent: true,
    read() {
      this.reads += 1
      return value
    },
    write(entries) {
      this.writes += 1
      value = entries
    },
    peek() {
      return value
    },
  }
}

const ids = (entries) => entries.map((entry) => entry.id)

test('history starts empty', () => {
  const service = createHistoryService(fakeStorage())
  assert.deepEqual(service.list(), [])
})

test('record adds a recipe as the newest entry', () => {
  const storage = fakeStorage()
  const service = createHistoryService(storage)

  service.record({ id: 'a', title: 'A' })
  service.record({ id: 'b', title: 'B' })

  assert.deepEqual(ids(service.list()), ['b', 'a'])
  assert.equal(service.list()[0].title, 'B')
  assert.ok(service.list()[0].cookedAt > 0)
  assert.ok(storage.writes >= 2, 'each change is persisted')
  assert.equal(storage.peek().length, 2)
})

test('cooking a recipe again moves it to the top instead of duplicating', () => {
  const service = createHistoryService(fakeStorage())
  service.record({ id: 'a', title: 'A', cookedAt: 1000 })
  service.record({ id: 'b', title: 'B', cookedAt: 2000 })
  service.record({ id: 'a', title: 'A again', cookedAt: 3000 })

  assert.deepEqual(ids(service.list()), ['a', 'b'])
  assert.equal(service.list()[0].title, 'A again')
  assert.equal(service.list().length, 2)
})

test('record ignores entries without a recipe id', () => {
  const service = createHistoryService(fakeStorage())
  service.record({ title: 'No id' })
  service.record()
  assert.deepEqual(service.list(), [])
})

test('stored history is deduped, sorted and validated on load', () => {
  const service = createHistoryService(
    fakeStorage([
      { id: 'old', title: 'Old', cookedAt: 100 },
      { id: 'new', title: 'New', cookedAt: 300 },
      { id: 'old', title: 'Old duplicate', cookedAt: 200 },
      { id: '', title: 'Broken' },
      { title: 'Also broken' },
    ]),
  )

  assert.deepEqual(ids(service.list()), ['new', 'old'])
  assert.equal(service.list()[1].title, 'Old')
})

test('history is capped at MAX_HISTORY entries', () => {
  const service = createHistoryService(fakeStorage())
  for (let i = 0; i < MAX_HISTORY + 5; i += 1) {
    service.record({ id: `recipe-${i}`, title: `Recipe ${i}`, cookedAt: i + 1 })
  }

  assert.equal(service.list().length, MAX_HISTORY)
  assert.equal(service.list()[0].id, `recipe-${MAX_HISTORY + 4}`)
})

test('remove and clear update the list and the storage', () => {
  const storage = fakeStorage()
  const service = createHistoryService(storage)
  service.record({ id: 'a', title: 'A' })
  service.record({ id: 'b', title: 'B' })

  service.remove('a')
  assert.deepEqual(ids(service.list()), ['b'])
  assert.deepEqual(ids(storage.peek()), ['b'])

  service.clear()
  assert.deepEqual(service.list(), [])
  assert.deepEqual(storage.peek(), [])
})

test('subscribers see the current list immediately and every change', () => {
  const service = createHistoryService(fakeStorage())
  const seen = []
  const unsubscribe = service.subscribe((entries) => seen.push(ids(entries)))

  service.record({ id: 'a', title: 'A' })
  service.record({ id: 'b', title: 'B' })
  unsubscribe()
  service.record({ id: 'c', title: 'C' })

  assert.deepEqual(seen, [[], ['a'], ['b', 'a']])
})

test('persistent reflects the storage adapter', () => {
  const service = createHistoryService(fakeStorage())
  assert.equal(service.persistent, true)

  const memoryOnly = createHistoryService({
    read: () => [],
    write: () => {},
  })
  assert.equal(memoryOnly.persistent, false)
})
