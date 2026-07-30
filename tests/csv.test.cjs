'use strict'
/** Unit tests — lib/hr/csv.ts (delimited parsing + CSV serialization). */
const test = require('node:test')
const assert = require('node:assert/strict')
const { parseDelimited, toCsv } = require('../.test-build/csv.js')

test('parseDelimited', async t => {
  await t.test('parses comma-separated rows with a header', () => {
    assert.deepEqual(parseDelimited('a,b\n1,2'), [['a', 'b'], ['1', '2']])
  })

  await t.test('auto-detects tabs, so Excel paste works', () => {
    assert.deepEqual(parseDelimited('a\tb\n1\t2'), [['a', 'b'], ['1', '2']])
  })

  await t.test('a comma inside a tab-separated cell is not a delimiter', () => {
    assert.deepEqual(
      parseDelimited('Name\tRate\nKim, Jordan\t21.50'),
      [['Name', 'Rate'], ['Kim, Jordan', '21.50']],
    )
  })

  await t.test('honours quoted fields containing the delimiter', () => {
    assert.deepEqual(parseDelimited('a,b\n"Kim, Jordan",8'), [['a', 'b'], ['Kim, Jordan', '8']])
  })

  await t.test('unescapes doubled quotes inside a quoted field', () => {
    assert.deepEqual(parseDelimited('a\n"He said ""hi"""'), [['a'], ['He said "hi"']])
  })

  await t.test('handles CRLF line endings', () => {
    assert.deepEqual(parseDelimited('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']])
  })

  await t.test('keeps empty interior cells but drops fully blank rows', () => {
    assert.deepEqual(parseDelimited('a,b,c\n1,,3\n\n,,\n4,5,6'),
      [['a', 'b', 'c'], ['1', '', '3'], ['4', '5', '6']])
  })

  await t.test('returns no rows for empty input', () => {
    assert.deepEqual(parseDelimited(''), [])
  })

  await t.test('parses a final line with no trailing newline', () => {
    assert.deepEqual(parseDelimited('a,b\n1,2\n3,4'), [['a', 'b'], ['1', '2'], ['3', '4']])
  })

  await t.test('preserves a newline inside a quoted field', () => {
    assert.deepEqual(parseDelimited('a,b\n"line1\nline2",x'), [['a', 'b'], ['line1\nline2', 'x']])
  })
})

test('toCsv', async t => {
  await t.test('joins cells with commas and CRLF-terminates every row', () => {
    assert.equal(toCsv([['a', 'b'], [1, 2]]), 'a,b\r\n1,2\r\n')
  })

  await t.test('quotes cells containing a comma', () => {
    assert.equal(toCsv([['Kim, Jordan']]), '"Kim, Jordan"\r\n')
  })

  await t.test('escapes embedded quotes by doubling them', () => {
    assert.equal(toCsv([['say "hi"']]), '"say ""hi"""\r\n')
  })

  await t.test('quotes cells containing newlines', () => {
    assert.equal(toCsv([['a\nb']]), '"a\nb"\r\n')
  })

  await t.test('leaves ordinary cells unquoted', () => {
    assert.equal(toCsv([['plain', 'text']]), 'plain,text\r\n')
  })

  await t.test('round-trips through parseDelimited without loss', () => {
    const rows = [['Name', 'Note'], ['Kim, Jordan', 'said "hi"'], ['Ruiz', 'plain']]
    assert.deepEqual(parseDelimited(toCsv(rows)), rows)
  })
})
