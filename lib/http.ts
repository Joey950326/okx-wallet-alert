/**
 * 基于 Fetch API 的 HTTP 请求库
 * 支持请求/响应拦截器、错误处理、超时控制等功能
 */

// ============ 类型定义 ============

export interface HttpRequestConfig extends RequestInit {
  url?: string
  baseURL?: string
  timeout?: number
  params?: Record<string, string | number | boolean>
  data?: unknown
  headers?: Record<string, string>
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'
}

export interface HttpResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Headers
  config: HttpRequestConfig
}

export class HttpError extends Error {
  public status?: number
  public response?: Response
  public config?: HttpRequestConfig

  constructor(message: string, status?: number, response?: Response, config?: HttpRequestConfig) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.response = response
    this.config = config
  }
}

type RequestInterceptor = (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>
type ResponseInterceptor = <T>(response: HttpResponse<T>) => HttpResponse<T> | Promise<HttpResponse<T>>
type ErrorInterceptor = (error: HttpError) => Promise<never>

// ============ HTTP 客户端类 ============

export class HttpClient {
  private baseURL: string
  private defaultTimeout: number
  private defaultHeaders: Record<string, string>
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor[] = []
  private errorInterceptors: ErrorInterceptor[] = []

  constructor(config?: HttpRequestConfig) {
    this.baseURL = config?.baseURL || ''
    this.defaultTimeout = config?.timeout || 30000
    this.defaultHeaders = (config?.headers as Record<string, string>) || {
      'Content-Type': 'application/json',
    }
  }

  /**
   * 添加请求拦截器
   */
  public addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor)
  }

  /**
   * 添加响应拦截器
   */
  public addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor)
  }

  /**
   * 添加错误拦截器
   */
  public addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor)
  }

  /**
   * 构建完整的 URL
   */
  private buildURL(url: string, params?: Record<string, string | number | boolean>): string {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`
    
    if (!params || Object.keys(params).length === 0) {
      return fullURL
    }

    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value))
    })

    const separator = fullURL.includes('?') ? '&' : '?'
    return `${fullURL}${separator}${searchParams.toString()}`
  }

  /**
   * 执行请求拦截器
   */
  private async runRequestInterceptors(config: HttpRequestConfig): Promise<HttpRequestConfig> {
    let finalConfig = { ...config }
    
    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig)
    }
    
    return finalConfig
  }

  /**
   * 执行响应拦截器
   */
  private async runResponseInterceptors<T>(response: HttpResponse<T>): Promise<HttpResponse<T>> {
    let finalResponse = response
    
    for (const interceptor of this.responseInterceptors) {
      finalResponse = await interceptor(finalResponse)
    }
    
    return finalResponse
  }

  /**
   * 执行错误拦截器
   */
  private async runErrorInterceptors(error: HttpError): Promise<never> {
    let finalError = error
    
    for (const interceptor of this.errorInterceptors) {
      try {
        await interceptor(finalError)
      } catch (err) {
        finalError = err as HttpError
      }
    }
    
    throw finalError
  }

  /**
   * 核心请求方法
   */
  public async request<T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    try {
      // 执行请求拦截器
      const finalConfig = await this.runRequestInterceptors(config)

      // 合并配置
      const url = this.buildURL(finalConfig.url || '', finalConfig.params)
      const timeout = finalConfig.timeout || this.defaultTimeout
      const headers = { ...this.defaultHeaders, ...finalConfig.headers }

      // 处理请求体
      let body: BodyInit | undefined
      if (finalConfig.data) {
        if (finalConfig.data instanceof FormData) {
          body = finalConfig.data
          delete headers['Content-Type'] // 让浏览器自动设置
        } else if (headers['Content-Type']?.includes('application/json')) {
          body = JSON.stringify(finalConfig.data)
        } else {
          body = finalConfig.data as BodyInit
        }
      }

      // 创建 AbortController 用于超时控制
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // 发起请求
      const response = await fetch(url, {
        ...finalConfig,
        headers,
        body,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // 检查响应状态
      if (!response.ok) {
        throw new HttpError(
          `HTTP Error: ${response.status} ${response.statusText}`,
          response.status,
          response,
          finalConfig
        )
      }

      // 解析响应数据
      const responseType = finalConfig.responseType || 'json'
      let data: T

      switch (responseType) {
        case 'json':
          data = await response.json() as T
          break
        case 'text':
          data = await response.text() as T
          break
        case 'blob':
          data = await response.blob() as T
          break
        case 'arrayBuffer':
          data = await response.arrayBuffer() as T
          break
        case 'formData':
          data = await response.formData() as T
          break
        default:
          data = await response.json() as T
      }

      // 构建响应对象
      const httpResponse: HttpResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: finalConfig,
      }

      // 执行响应拦截器
      return await this.runResponseInterceptors(httpResponse)

    } catch (error) {
      // 处理错误
      if (error instanceof HttpError) {
        return await this.runErrorInterceptors(error)
      }

      if (error instanceof Error) {
        const httpError = new HttpError(
          error.name === 'AbortError' ? 'Request timeout' : error.message,
          undefined,
          undefined,
          config
        )
        return await this.runErrorInterceptors(httpError)
      }

      const unknownError = new HttpError('Unknown error occurred', undefined, undefined, config)
      return await this.runErrorInterceptors(unknownError)
    }
  }

  /**
   * GET 请求
   */
  public async get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({
      ...config,
      url,
      method: 'GET',
    })
  }

  /**
   * POST 请求
   */
  public async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      ...config,
      url,
      method: 'POST',
      data,
    })
  }

  /**
   * PUT 请求
   */
  public async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      ...config,
      url,
      method: 'PUT',
      data,
    })
  }

  /**
   * PATCH 请求
   */
  public async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>({
      ...config,
      url,
      method: 'PATCH',
      data,
    })
  }

  /**
   * DELETE 请求
   */
  public async delete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({
      ...config,
      url,
      method: 'DELETE',
    })
  }

  /**
   * HEAD 请求
   */
  public async head<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({
      ...config,
      url,
      method: 'HEAD',
    })
  }

  /**
   * OPTIONS 请求
   */
  public async options<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({
      ...config,
      url,
      method: 'OPTIONS',
    })
  }
}

// ============ 创建默认实例 ============

export const http = new HttpClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ============ 便捷方法导出 ============

export const request = http.request.bind(http)
export const get = http.get.bind(http)
export const post = http.post.bind(http)
export const put = http.put.bind(http)
export const patch = http.patch.bind(http)
export const del = http.delete.bind(http)
export const head = http.head.bind(http)
export const options = http.options.bind(http)

export default http
