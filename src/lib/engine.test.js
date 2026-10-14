// Run with: node src/lib/engine.test.js
import assert from 'node:assert/strict'
import { settleLineup, maxMultiplier, validateLineup, parseBulk, resolveMode, singlesToWin } from './engine.js'

const P = (id, status, result, kind = 'standard', line = 2.5) => ({ id, status, result, line, kind, playerId: 'pl' + id })
const pk = (id, side, kind = 'standard', line = 2.5) => ({ propId: id, playerId: 'pl' + id, side, line, kind })
const by = (...ps) => Object.fromEntries(ps.map((p) => [p.id, p]))
const win = (x) => P(x, 'final', 5)
const loss = (x) => P(x, 'final', 0)
const open = (x) => P(x, 'open', null)
const voided = (x) => P(x, 'void', null)
const check = (r, status, payout) => assert.deepEqual([r.status, r.payout], [status, payout])

// Power: all hit → 3-pick 5x
check(settleLineup({ mode: 'power', amount: 10, picks: [pk('a', 'more'), pk('b', 'less'), pk('c', 'more')] }, by(win('a'), loss('b'), win('c'))), 'won', 50)
// Power: one miss settles lost even while others are pending
check(settleLineup({ mode: 'power', amount: 10, picks: [pk('a', 'more'), pk('b', 'less')] }, by(loss('a'), open('b'))), 'lost', 0)
assert.equal(settleLineup({ mode: 'power', amount: 10, picks: [pk('a', 'more'), pk('b', 'less')] }, by(win('a'), open('b'))).status, 'open')
// Void drops a size: 3-pick → 2-pick 3x; 2-pick → refund
check(settleLineup({ mode: 'power', amount: 10, picks: [pk('a', 'more'), pk('b', 'less'), pk('c', 'more')] }, by(win('a'), voided('b'), win('c'))), 'won', 30)
check(settleLineup({ mode: 'power', amount: 10, picks: [pk('a', 'more'), pk('b', 'less')] }, by(win('a'), voided('b'))), 'refunded', 10)
// Push (result == line) counts as void
check(
  settleLineup({ mode: 'power', amount: 10, picks: [pk('a', 'more', 'standard', 3), pk('b', 'less'), pk('c', 'more')] }, by(P('a', 'final', 3, 'standard', 3), loss('b'), win('c'))),
  'won',
  30,
)
// Flex 5-pick tiers
const five = ['a', 'b', 'c', 'd', 'e'].map((x) => pk(x, 'more'))
check(settleLineup({ mode: 'flex', amount: 10, picks: five }, by(win('a'), win('b'), win('c'), win('d'), win('e'))), 'won', 100)
check(settleLineup({ mode: 'flex', amount: 10, picks: five }, by(win('a'), win('b'), win('c'), win('d'), loss('e'))), 'won', 20)
check(settleLineup({ mode: 'flex', amount: 10, picks: five }, by(win('a'), win('b'), win('c'), loss('d'), loss('e'))), 'won', 4)
assert.equal(settleLineup({ mode: 'flex', amount: 10, picks: five }, by(win('a'), loss('b'), loss('c'), loss('d'), open('e'))).status, 'lost')
// Flex 3-pick with a void reverts to 2-pick Power
check(settleLineup({ mode: 'flex', amount: 10, picks: five.slice(0, 3) }, by(win('a'), win('b'), voided('c'))), 'won', 30)
// Goblin / Demon factors
assert.equal(maxMultiplier('power', [pk('a', 'more', 'demon'), pk('b', 'more', 'goblin')]), 3.6)
check(settleLineup({ mode: 'power', amount: 10, picks: [pk('a', 'more', 'demon'), pk('b', 'more')] }, by(P('a', 'final', 3, 'demon'), P('b', 'final', 3))), 'won', 45)
// Validation
assert.equal(validateLineup([pk('a', 'more')], 'power', 10, 100), 'Add at least 2 picks')
assert.equal(validateLineup([pk('a', 'more'), { ...pk('b', 'more'), playerId: 'pla' }], 'power', 10, 100), 'Only one pick per person')
assert.equal(validateLineup([pk('a', 'less', 'goblin'), pk('b', 'more')], 'power', 10, 100), 'Goblins & Demons are More only')
assert.equal(validateLineup([pk('a', 'more'), pk('b', 'more')], 'flex', 10, 100), 'Flex Play needs 3+ picks')
assert.equal(validateLineup([pk('a', 'more'), pk('b', 'more')], 'power', 200, 100), 'Not enough balance')
assert.equal(validateLineup([pk('a', 'more'), pk('b', 'more')], 'power', 20, 100), null)
// Singles: even money, void refunds, kinds apply, one-per-person not enforced
check(settleLineup({ mode: 'single', amount: 10, picks: [pk('a', 'more')] }, by(win('a'))), 'won', 20)
check(settleLineup({ mode: 'single', amount: 10, picks: [pk('a', 'less')] }, by(win('a'))), 'lost', 0)
check(settleLineup({ mode: 'single', amount: 10, picks: [pk('a', 'more')] }, by(voided('a'))), 'refunded', 10)
check(settleLineup({ mode: 'single', amount: 10, picks: [pk('a', 'more', 'demon')] }, by(P('a', 'final', 3, 'demon'))), 'won', 30)
assert.equal(settleLineup({ mode: 'single', amount: 10, picks: [pk('a', 'more')] }, by(open('a'))).status, 'open')
assert.equal(resolveMode('power', 1), 'single')
assert.equal(resolveMode('flex', 2), 'power')
assert.equal(resolveMode('single', 3), 'single')
assert.equal(singlesToWin(10, [pk('a', 'more'), pk('b', 'more', 'goblin')]), 36)
assert.equal(validateLineup([pk('a', 'more'), { ...pk('b', 'more'), playerId: 'pla' }], 'single', 10, 100), null)
assert.equal(validateLineup([pk('a', 'more'), pk('b', 'more')], 'single', 60, 100), 'Not enough balance')
// Bulk paste
const b = parseBulk('Byron | Says "that\'s awesome" | 2.5 | Quotes\nNobody | x | 1\nByron | sleep | abc', [{ id: '1', name: 'Byron' }])
assert.equal(b.props.length, 1)
assert.equal(b.errors.length, 2)

console.log('engine: all assertions passed')
