import axios, { type AxiosRequestConfig } from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'

import { createApiClient, type ApiClient } from '../../src/services/api'
import { loadFixture } from './fixtures'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

type FixtureRoute = Readonly<{
  method: HttpMethod
  url: string
  status?: number
  response?: unknown
  responseFixture?: string
  once?: boolean
}>

type FixtureScenario = Readonly<{
  routes: readonly FixtureRoute[]
}>

type SetupHttpFixtureTestOptions = Readonly<{
  routes?: readonly FixtureRoute[]
  scenarioFixture?: string
  strictUnhandled?: boolean
}>

export type RequestLogEntry = Readonly<{
  method: HttpMethod
  url: string
  query?: unknown
  body?: unknown
}>

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value == null || typeof value !== 'object') {
    return false
  }
  return Object.getPrototypeOf(value) === Object.prototype
}

const isHttpMethod = (value: unknown): value is HttpMethod =>
  value === 'GET' || value === 'POST' || value === 'PUT' || value === 'DELETE'

const isFixtureRoute = (value: unknown): value is FixtureRoute => {
  if (!isPlainObject(value)) {
    return false
  }

  return isHttpMethod(value.method) && typeof value.url === 'string'
}

const isFixtureScenario = (value: unknown): value is FixtureScenario =>
  isPlainObject(value) && Array.isArray(value.routes) && value.routes.every(isFixtureRoute)

const toSortedValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => toSortedValue(item))
  }
  if (!isPlainObject(value)) {
    return value
  }

  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
  return Object.fromEntries(entries.map(([key, item]) => [key, toSortedValue(item)]))
}

const toQueryRecord = (searchParams: URLSearchParams): Record<string, string | readonly string[]> => {
  const grouped = new Map<string, string[]>()

  for (const [key, value] of searchParams.entries()) {
    const current = grouped.get(key)
    if (current) {
      current.push(value)
      continue
    }
    grouped.set(key, [value])
  }

  const result: Record<string, string | readonly string[]> = {}
  for (const [key, values] of grouped.entries()) {
    result[key] = values.length === 1 ? values[0] : values
  }
  return result
}

const parseBody = (data: unknown): unknown => {
  if (typeof data !== 'string') {
    return data
  }

  const trimmed = data.trim()
  if (trimmed === '') {
    return undefined
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return data
  }
}

const toHttpMethod = (method: string | undefined): HttpMethod => {
  const normalized = method?.toUpperCase()

  if (normalized === 'POST') {
    return 'POST'
  }
  if (normalized === 'PUT') {
    return 'PUT'
  }
  if (normalized === 'DELETE') {
    return 'DELETE'
  }
  return 'GET'
}

type RequestSource = Readonly<Pick<AxiosRequestConfig, 'method' | 'url' | 'params' | 'data'>>

const normalizeRequest = (config: RequestSource): RequestLogEntry => {
  const method = toHttpMethod(config.method)
  const parsedUrl = new URL(config.url ?? '/', 'http://localhost')
  const url = parsedUrl.pathname

  const queryFromUrl = parsedUrl.search === '' ? undefined : toQueryRecord(parsedUrl.searchParams)
  const queryCandidate =
    config.params instanceof URLSearchParams
      ? toQueryRecord(config.params)
      : config.params == null
        ? queryFromUrl
        : config.params
  const query = toSortedValue(queryCandidate)
  const body = toSortedValue(parseBody(config.data))

  return {
    method,
    url,
    ...(query == null || (isPlainObject(query) && Object.keys(query).length === 0) ? {} : { query }),
    ...(body === undefined ? {} : { body }),
  }
}

const resolveScenarioRoutes = (scenarioFixture?: string): readonly FixtureRoute[] => {
  if (!scenarioFixture) {
    return []
  }

  const scenario = loadFixture(scenarioFixture)
  if (!isFixtureScenario(scenario)) {
    throw new Error(`Invalid fixture scenario format: ${scenarioFixture}`)
  }

  return scenario.routes
}

const resolveRouteBody = (route: FixtureRoute): unknown => {
  if (route.responseFixture) {
    return loadFixture(route.responseFixture)
  }
  if ('response' in route) {
    return route.response
  }
  return null
}

const registerRoute = (mock: AxiosMockAdapter, route: FixtureRoute, requestLog: RequestLogEntry[]) => {
  const reply = (config: AxiosRequestConfig): [number, unknown] => {
    requestLog.push(normalizeRequest(config))
    return [route.status ?? 200, resolveRouteBody(route)]
  }

  switch (route.method) {
    case 'GET':
      if (route.once) {
        mock.onGet(route.url).replyOnce(reply)
      } else {
        mock.onGet(route.url).reply(reply)
      }
      return
    case 'POST':
      if (route.once) {
        mock.onPost(route.url).replyOnce(reply)
      } else {
        mock.onPost(route.url).reply(reply)
      }
      return
    case 'PUT':
      if (route.once) {
        mock.onPut(route.url).replyOnce(reply)
      } else {
        mock.onPut(route.url).reply(reply)
      }
      return
    case 'DELETE':
      if (route.once) {
        mock.onDelete(route.url).replyOnce(reply)
      } else {
        mock.onDelete(route.url).reply(reply)
      }
      return
  }
}

export const setupHttpFixtureTest = ({
  routes = [],
  scenarioFixture,
  strictUnhandled = true,
}: SetupHttpFixtureTestOptions = {}) => {
  const requestLog: RequestLogEntry[] = []
  const axiosInstance = axios.create({
    baseURL: 'http://localhost/api',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  const mock = new AxiosMockAdapter(axiosInstance)

  const allRoutes = [...resolveScenarioRoutes(scenarioFixture), ...routes]
  for (const route of allRoutes) {
    registerRoute(mock, route, requestLog)
  }

  if (strictUnhandled) {
    mock.onAny().reply((config) => {
      const request = normalizeRequest(config)
      requestLog.push(request)
      throw new Error(`Unhandled mock request: ${request.method} ${request.url}`)
    })
  }

  const noop = () => {}
  const apiClient: ApiClient = createApiClient(axiosInstance, {
    onRequestStart: noop,
    onRequestEnd: noop,
  })

  return {
    apiClient,
    requestLog,
    clearRequests: () => {
      requestLog.length = 0
      mock.resetHistory()
    },
    restore: () => {
      mock.restore()
    },
  } as const
}
