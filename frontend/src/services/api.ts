import type {
  ApiEndpoint,
  ApiError,
  ApiQuery,
  ApiRequest,
  ApiResponse,
  DeleteEndpoint,
  GetEndpoint,
  PostEndpoint,
  PutEndpoint,
} from '@todoapp/shared'

import axios, { isAxiosError, type AxiosInstance } from 'axios'

import config from '../config'
import { type Result, err, ok } from '../models/result'
import { authToken } from './authToken'

type ApiGetOptions = Readonly<{
  key?: string
  mode?: 'latestOnly'
}>

type ApiGetConfig<Params> = Readonly<{
  params?: Params
  options?: ApiGetOptions
}>

type ApiGetQuery = Readonly<Record<string, unknown>>
type ApiGetConfigAny = ApiGetConfig<ApiGetQuery>

type ApiGetParamsInput<E extends GetEndpoint> =
  ApiQuery<'get', E> extends ApiGetQuery
    ? ApiQuery<'get', E> | ApiGetConfig<ApiQuery<'get', E>> | undefined
    :
        | Readonly<{
            options?: ApiGetOptions
          }>
        | undefined

type ApiPostRequestArgs<E extends PostEndpoint> =
  ApiRequest<'post', E> extends undefined ? readonly [data?: undefined] : readonly [data: ApiRequest<'post', E>]

type ApiPutRequestArgs<E extends PutEndpoint> =
  ApiRequest<'put', E> extends undefined ? readonly [data?: undefined] : readonly [data: ApiRequest<'put', E>]

export type ApiClient = Readonly<{
  get: <E extends GetEndpoint>(url: E, params?: ApiGetParamsInput<E>) => Promise<ApiResponse<'get', E>>
  post: {
    <E extends PostEndpoint>(
      url: E,
      ...args: ApiPostRequestArgs<E>
    ): Promise<Result<ApiResponse<'post', E>, ApiError<'post', E>>>
  }
  put: {
    <E extends PutEndpoint>(
      url: E,
      ...args: ApiPutRequestArgs<E>
    ): Promise<Result<ApiResponse<'put', E>, ApiError<'put', E>>>
  }
  delete: {
    <E extends DeleteEndpoint>(url: E): Promise<ApiResponse<'delete', E>>
  }
}>

/**
 * Axios インスタンス作成
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: config.API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // リクエストインターセプター: トークン自動付与
  instance.interceptors.request.use((config) => {
    const token = authToken.get()
    if (token != null) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  return instance
}

export type ApiClientCallbacks = Readonly<{
  onRequestStart: () => void
  onRequestEnd: () => void
}>

export const createApiClient = (
  axiosInstance: AxiosInstance = createAxiosInstance(),
  callbacks: ApiClientCallbacks,
): ApiClient => {
  const { onRequestStart, onRequestEnd } = callbacks
  const abortControllers = new Map<string, AbortController>()

  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

  const isGetConfig = (value: unknown): value is ApiGetConfigAny => {
    if (!isRecord(value)) {
      return false
    }
    return 'params' in value || 'options' in value
  }

  const resolveParams = (params?: unknown): ApiGetQuery | undefined => {
    if (!isRecord(params)) {
      return undefined
    }
    if (!isGetConfig(params)) {
      return params
    }
    if (!isRecord(params.params)) {
      return undefined
    }
    return params.params
  }

  const resolveOptions = (params?: unknown): ApiGetOptions | undefined =>
    isGetConfig(params) ? params.options : undefined

  const withTracking = async <T>(fn: () => Promise<T>): Promise<T> => {
    onRequestStart?.()
    try {
      return await fn()
    } finally {
      onRequestEnd?.()
    }
  }

  const toHandledApiError = <M extends 'post' | 'put', E extends ApiEndpoint<M>>(
    error: unknown,
  ): ApiError<M, E> | null => {
    if (!isAxiosError<ApiError<M, E>>(error) || error.response == null) {
      return null
    }
    if (error.response.status !== 409 && error.response.status !== 422) {
      return null
    }
    return error.response.data
  }

  return {
    get: async <E extends GetEndpoint>(url: E, params?: ApiGetParamsInput<E>): Promise<ApiResponse<'get', E>> =>
      withTracking(async () => {
        const resolvedParams = resolveParams(params)
        const resolvedOptions = resolveOptions(params)
        const requestKey = resolvedOptions?.key
        const shouldAbortPrevious = resolvedOptions?.mode === 'latestOnly' && requestKey != null
        let abortController: AbortController | undefined

        if (shouldAbortPrevious && requestKey) {
          abortController = new AbortController()
          abortControllers.get(requestKey)?.abort()
          abortControllers.set(requestKey, abortController)
        }

        try {
          const response = await axiosInstance.get<ApiResponse<'get', E>>(url, {
            params: resolvedParams,
            signal: abortController?.signal,
          })
          return response.data
        } finally {
          if (
            shouldAbortPrevious &&
            requestKey &&
            abortController &&
            abortControllers.get(requestKey) === abortController
          ) {
            abortControllers.delete(requestKey)
          }
        }
      }),

    post: async <E extends PostEndpoint>(
      url: E,
      ...args: ApiPostRequestArgs<E>
    ): Promise<Result<ApiResponse<'post', E>, ApiError<'post', E>>> =>
      withTracking(async () => {
        const data = args[0]
        try {
          const response = await axiosInstance.post<ApiResponse<'post', E>>(url, data)
          return ok(response.data)
        } catch (error) {
          const handledError = toHandledApiError<'post', E>(error)
          if (handledError != null) {
            return err(handledError)
          }
          throw error
        }
      }),

    put: async <E extends PutEndpoint>(
      url: E,
      ...args: ApiPutRequestArgs<E>
    ): Promise<Result<ApiResponse<'put', E>, ApiError<'put', E>>> =>
      withTracking(async () => {
        const data = args[0]
        try {
          const response = await axiosInstance.put<ApiResponse<'put', E>>(url, data)
          return ok(response.data)
        } catch (error) {
          const handledError = toHandledApiError<'put', E>(error)
          if (handledError != null) {
            return err(handledError)
          }
          throw error
        }
      }),

    delete: async <E extends DeleteEndpoint>(url: E): Promise<ApiResponse<'delete', E>> =>
      withTracking(async () => {
        const response = await axiosInstance.delete<ApiResponse<'delete', E>>(url)
        return response.data
      }),
  }
}
