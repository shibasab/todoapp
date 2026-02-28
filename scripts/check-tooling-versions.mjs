import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = process.cwd()
const rootPackagePath = resolve(rootDir, 'package.json')
const workspacePackagePaths = [
  resolve(rootDir, 'backend/package.json'),
  resolve(rootDir, 'frontend/package.json'),
  resolve(rootDir, 'shared/package.json'),
]

const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf-8'))
const overrides = rootPackage.overrides ?? {}

const targets = [
  'typescript',
  '@typescript/native-preview',
  'oxlint',
  'oxfmt',
  'oxlint-tsgolint',
  'vitest',
  '@vitest/coverage-v8',
]

const errors = []

for (const depName of targets) {
  const expected = overrides[depName]
  if (expected == null) {
    errors.push(`root overrides に ${depName} が定義されていません`)
  }
}

for (const workspacePath of workspacePackagePaths) {
  const workspacePackage = JSON.parse(readFileSync(workspacePath, 'utf-8'))
  const workspaceName = workspacePackage.name ?? workspacePath
  const devDependencies = workspacePackage.devDependencies ?? {}

  for (const depName of targets) {
    if (!(depName in devDependencies)) {
      continue
    }

    const expected = overrides[depName]
    const actual = devDependencies[depName]
    if (expected !== actual) {
      errors.push(
        `${workspaceName}: ${depName} の宣言が不一致です (actual: ${actual}, expected: ${expected})`,
      )
    }
  }
}

if (errors.length > 0) {
  console.error('ツールバージョンの共通化チェックに失敗しました。')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log('ツールバージョンの共通化チェックに成功しました。')
