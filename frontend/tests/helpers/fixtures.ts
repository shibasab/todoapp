import { readFileSync } from 'node:fs'
import { resolve, normalize, sep } from 'node:path'

const FIXTURES_ROOT = resolve('tests', 'fixtures')
const FIXTURES_ROOT_WITH_SEPARATOR = FIXTURES_ROOT.endsWith(sep) ? FIXTURES_ROOT : `${FIXTURES_ROOT}${sep}`

/**
 * tests/fixtures 配下の JSON を読み込む
 */
export const loadFixture = (fixturePath: string): unknown => {
  const normalizedPath = fixturePath.replace(/^[/\\]+/, '')
  const absoluteFixturePath = normalize(resolve(FIXTURES_ROOT, normalizedPath))
  const fixturePathLower = absoluteFixturePath.toLowerCase()
  const rootPathLower = FIXTURES_ROOT_WITH_SEPARATOR.toLowerCase()

  if (!fixturePathLower.startsWith(rootPathLower)) {
    throw new Error(`Fixture path must stay inside tests/fixtures: ${fixturePath}`)
  }

  const raw = readFileSync(absoluteFixturePath, 'utf-8')
  return JSON.parse(raw)
}
