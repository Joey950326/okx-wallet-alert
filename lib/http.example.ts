/**
 * HTTP 请求库使用示例
 * 这个文件展示了如何使用封装的 HTTP 请求库
 */

import { http, HttpClient, get, post, type HttpResponse } from './http'

// ============ 示例 1: 基础使用 ============

// GET 请求
async function example1() {
  try {
    const response = await get<{ message: string }>('/api/hello')
    console.log(response.data.message)
  } catch (error) {
    console.error('请求失败:', error)
  }
}

// POST 请求
async function example2() {
  try {
    const response = await post<{ id: number }>('/api/users', {
      name: 'John Doe',
      email: 'john@example.com',
    })
    console.log('创建的用户ID:', response.data.id)
  } catch (error) {
    console.error('创建用户失败:', error)
  }
}

// ============ 示例 2: 使用查询参数 ============

async function example3() {
  const response = await get('/api/users', {
    params: {
      page: 1,
      limit: 10,
      sort: 'name',
    },
  })
  console.log(response.data)
}

// ============ 示例 3: 自定义配置 ============

async function example4() {
  const data = new FormData()
  data.append('file', 'test')
  
  const response = await post('/api/upload', data, {
    timeout: 60000, // 60秒超时
    headers: {
      'X-Custom-Header': 'custom-value',
    },
  })
  console.log(response.data)
}

// ============ 示例 4: 使用请求拦截器 ============

// 添加认证 token
http.addRequestInterceptor((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }
  return config
})

// 添加请求日志
http.addRequestInterceptor((config) => {
  console.log('发起请求:', config.method, config.url || '')
  return config
})

// ============ 示例 5: 使用响应拦截器 ============

// 处理响应数据格式
http.addResponseInterceptor((response) => {
  console.log('收到响应:', response.status, response.statusText)
  return response
})

// 自动刷新token示例
http.addResponseInterceptor(async (response) => {
  const newToken = response.headers.get('X-New-Token')
  if (newToken) {
    localStorage.setItem('auth_token', newToken)
  }
  return response
})

// ============ 示例 6: 使用错误拦截器 ============

// 全局错误处理
http.addErrorInterceptor(async (error) => {
  if (error.status === 401) {
    // 未授权，跳转到登录页
    console.log('未授权，请重新登录')
    // window.location.href = '/login'
  } else if (error.status === 500) {
    console.error('服务器错误:', error.message)
  }
  throw error
})

// ============ 示例 7: 创建自定义客户端 ============

// 为特定 API 创建独立的客户端实例
const apiClient = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key',
  },
})

// 为这个客户端添加拦截器
apiClient.addRequestInterceptor((config) => {
  console.log('API 请求:', config.url || '')
  return config
})

async function example5() {
  const response = await apiClient.get('/data')
  console.log(response.data)
}

// ============ 示例 8: 处理不同响应类型 ============

// 获取文本
async function example6() {
  const response = await get<string>('/api/text', {
    responseType: 'text',
  })
  console.log(response.data)
}

// 下载文件
async function example7() {
  const response = await get<Blob>('/api/download', {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'file.pdf'
  a.click()
}

// ============ 示例 9: 上传文件 ============

async function example8(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('description', '文件描述')

  try {
    const response = await post<{ url: string }>('/api/upload', formData)
    console.log('文件上传成功:', response.data.url)
  } catch (error) {
    console.error('文件上传失败:', error)
  }
}

// ============ 示例 10: TypeScript 类型安全 ============

interface User {
  id: number
  name: string
  email: string
  createdAt: string
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

async function example9() {
  // 完整的类型支持
  const response: HttpResponse<PaginatedResponse<User>> = await get('/api/users', {
    params: { page: 1, limit: 10 },
  })

  // TypeScript 会提供完整的类型提示
  response.data.data.forEach((user) => {
    console.log(user.name, user.email)
  })
}

// ============ 示例 11: 错误处理最佳实践 ============

async function example10() {
  try {
    const response = await get<User>('/api/user/123')
    return response.data
  } catch (error) {
    if (error instanceof Error) {
      // 可以访问错误的详细信息
      console.error('错误信息:', error.message)
    }
    throw error
  }
}

// ============ 示例 12: 取消请求 ============

async function example11() {
  const controller = new AbortController()

  // 5秒后取消请求
  setTimeout(() => controller.abort(), 5000)

  try {
    const response = await get('/api/slow-endpoint', {
      signal: controller.signal,
    })
    console.log(response.data)
  } catch (error) {
    console.log('请求被取消')
  }
}

// ============ 示例 13: 在 React 组件中使用 ============

/*
// 在 React 组件中
import { get } from '@/lib/http'
import { useEffect, useState } from 'react'

function UserList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        const response = await get<User[]>('/api/users')
        setUsers(response.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    void fetchUsers()
  }, [])

  if (loading) return <div>加载中...</div>
  if (error) return <div>错误: {error}</div>

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
*/

// ============ 示例 14: 在 Server Actions 中使用 ============

/*
// app/actions.ts
'use server'

import { get, post } from '@/lib/http'

export async function getUsers() {
  const response = await get<User[]>('/api/users')
  return response.data
}

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string

  const response = await post<User>('/api/users', { name, email })
  return response.data
}
*/

export {
  example1,
  example2,
  example3,
  example4,
  example5,
  example6,
  example7,
  example8,
  example9,
  example10,
  example11,
}
