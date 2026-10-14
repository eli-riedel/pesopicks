// Sample crew + lines so the board isn't empty on day one. Commissioner can edit or delete.
export const SAMPLE_FRIENDS = [
  { name: 'Byron', nickname: 'Byron', emoji: '🤙', color: '#00afff' },
  { name: 'Jake', nickname: 'Jake', emoji: '🍺', color: '#ffd600' },
  { name: 'Sam', nickname: 'Sam', emoji: '🌮', color: '#ff8a00' },
  { name: 'Alex', nickname: 'Alex', emoji: '🏄', color: '#2fbf3a' },
  { name: 'Chris', nickname: 'Chris', emoji: '🕺', color: '#dd23bb' },
  { name: 'Taylor', nickname: 'Taylor', emoji: '😴', color: '#8000ff' },
]

function at(hour, dayOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, 0, 0, 0)
  if (d.getTime() < Date.now() + 30 * 60000) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

// [name, stat, line, category, kind, event, when]
export function sampleProps() {
  const tonight = at(21)
  const dinner = at(19)
  const tomorrow = at(15, 1)
  return [
    ['Byron', 'Says “That’s awesome”', 2.5, 'Quotes', 'standard', 'All day', tonight],
    ['Byron', 'Says “That’s awesome”', 4.5, 'Quotes', 'demon', 'All day', tonight],
    ['Jake', 'Beers before dinner', 4.5, 'Drinks', 'standard', 'Pool bar', dinner],
    ['Jake', 'Beers before dinner', 2.5, 'Drinks', 'goblin', 'Pool bar', dinner],
    ['Sam', 'Tacos eaten', 6.5, 'Food', 'standard', 'Taco stand', dinner],
    ['Alex', 'Minutes late to dinner', 12.5, 'Chaos', 'standard', 'Dinner', dinner],
    ['Chris', 'Shots at the club', 3.5, 'Shots', 'standard', 'Club night', tonight],
    ['Taylor', 'Hours of sleep', 5.5, 'Sleep', 'standard', 'Hotel', tomorrow],
    ['Byron', 'Gets sunburned (Yes = More)', 0.5, 'Beach', 'standard', 'Beach day', tomorrow],
    ['Jake', 'Falls asleep on the beach (Yes = More)', 0.5, 'Beach', 'standard', 'Beach day', tomorrow],
    ['Sam', 'Spanish words attempted', 15.5, 'Quotes', 'standard', 'All day', tonight],
    ['Alex', 'Times on phone at dinner', 4.5, 'Phone', 'standard', 'Dinner', dinner],
    ['Chris', 'Pool volleyball wins', 2.5, 'Sports', 'standard', 'Pool', tomorrow],
    ['Taylor', 'Margaritas', 3.5, 'Drinks', 'standard', 'Swim-up bar', tonight],
  ]
}
