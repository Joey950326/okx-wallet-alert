import { Prisma } from '../../../generated/prisma/client'
import { prisma, type PrismaTx } from '../client'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

const adminUserPublicSelect = {
  id: true,
  username: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.adminUserSelect

const adminUserAuthSelect = {
  id: true,
  username: true,
  password: true,
} satisfies Prisma.adminUserSelect

type DbClient = PrismaTx | typeof prisma

export type AdminUserPublic = Prisma.adminUserGetPayload<{
  select: typeof adminUserPublicSelect
}>

export type AdminUserAuth = Prisma.adminUserGetPayload<{
  select: typeof adminUserAuthSelect
}>

export type CreateAdminUserInput = {
  username: string
  passwordHash: string
}

export type UpdateAdminUserInput = {
  id: string
  username?: string
  passwordHash?: string
}

export type ListAdminUsersInput = {
  cursor?: string
  take?: number
}

export class AdminUserConflictError extends Error {
  constructor(username: string) {
    super(`Admin username "${username}" already exists`)
    this.name = 'AdminUserConflictError'
  }
}

export class AdminUserNotFoundError extends Error {
  constructor(id: string) {
    super(`Admin user "${id}" was not found`)
    this.name = 'AdminUserNotFoundError'
  }
}

function resolveDb(tx?: PrismaTx): DbClient {
  return tx ?? prisma
}

function normalizeNonEmpty(value: string, fieldName: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${fieldName} is required`)
  }

  return normalized
}

function normalizeTake(take?: number): number {
  if (typeof take !== 'number' || !Number.isFinite(take)) {
    return DEFAULT_PAGE_SIZE
  }

  const normalized = Math.floor(take)
  if (normalized <= 0) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(normalized, MAX_PAGE_SIZE)
}

function isUsernameConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }

  const target = error.meta?.target
  if (typeof target === 'string') {
    return target.includes('username')
  }

  if (Array.isArray(target)) {
    return target.some((item) => item === 'username')
  }

  return false
}

function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export async function createAdminUser(
  input: CreateAdminUserInput,
  tx?: PrismaTx
): Promise<AdminUserPublic> {
  const db = resolveDb(tx)
  const username = normalizeNonEmpty(input.username, 'username')
  const passwordHash = normalizeNonEmpty(input.passwordHash, 'passwordHash')

  try {
    return await db.adminUser.create({
      data: {
        username,
        password: passwordHash,
      },
      select: adminUserPublicSelect,
    })
  } catch (error) {
    if (isUsernameConflict(error)) {
      throw new AdminUserConflictError(username)
    }

    throw error
  }
}

export async function findAdminUserById(id: string, tx?: PrismaTx): Promise<AdminUserPublic | null> {
  const db = resolveDb(tx)
  const normalizedId = normalizeNonEmpty(id, 'id')

  return db.adminUser.findUnique({
    where: { id: normalizedId },
    select: adminUserPublicSelect,
  })
}

export async function findAdminUserByUsername(
  username: string,
  tx?: PrismaTx
): Promise<AdminUserPublic | null> {
  const db = resolveDb(tx)
  const normalizedUsername = normalizeNonEmpty(username, 'username')

  return db.adminUser.findUnique({
    where: { username: normalizedUsername },
    select: adminUserPublicSelect,
  })
}

export async function findAdminUserForAuth(
  username: string,
  tx?: PrismaTx
): Promise<AdminUserAuth | null> {
  const db = resolveDb(tx)
  const normalizedUsername = normalizeNonEmpty(username, 'username')

  return db.adminUser.findUnique({
    where: { username: normalizedUsername },
    select: adminUserAuthSelect,
  })
}

export async function listAdminUsers(
  input: ListAdminUsersInput = {},
  tx?: PrismaTx
): Promise<{ items: AdminUserPublic[]; nextCursor: string | null }> {
  const db = resolveDb(tx)
  const take = normalizeTake(input.take)
  const normalizedCursor = input.cursor?.trim() || undefined

  // Read one extra row to compute whether next page exists.
  const rows = await db.adminUser.findMany({
    select: adminUserPublicSelect,
    take: take + 1,
    ...(normalizedCursor
      ? {
          cursor: { id: normalizedCursor },
          skip: 1,
        }
      : {}),
    orderBy: {
      id: 'asc',
    },
  })

  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null

  return { items, nextCursor }
}

export async function updateAdminUser(
  input: UpdateAdminUserInput,
  tx?: PrismaTx
): Promise<AdminUserPublic> {
  const db = resolveDb(tx)
  const id = normalizeNonEmpty(input.id, 'id')
  const data: Prisma.adminUserUpdateInput = {}

  if (input.username !== undefined) {
    data.username = normalizeNonEmpty(input.username, 'username')
  }

  if (input.passwordHash !== undefined) {
    data.password = normalizeNonEmpty(input.passwordHash, 'passwordHash')
  }

  if (Object.keys(data).length === 0) {
    throw new Error('At least one field is required to update admin user')
  }

  try {
    return await db.adminUser.update({
      where: { id },
      data,
      select: adminUserPublicSelect,
    })
  } catch (error) {
    if (isNotFound(error)) {
      throw new AdminUserNotFoundError(id)
    }

    if (isUsernameConflict(error) && typeof data.username === 'string') {
      throw new AdminUserConflictError(data.username)
    }

    throw error
  }
}

export async function deleteAdminUser(id: string, tx?: PrismaTx): Promise<void> {
  const db = resolveDb(tx)
  const normalizedId = normalizeNonEmpty(id, 'id')

  try {
    await db.adminUser.delete({
      where: { id: normalizedId },
    })
  } catch (error) {
    if (isNotFound(error)) {
      throw new AdminUserNotFoundError(normalizedId)
    }

    throw error
  }
}

export async function createAdminUsersBatch(
  users: CreateAdminUserInput[]
): Promise<AdminUserPublic[]> {
  return prisma.$transaction(async (tx) => {
    const createdUsers: AdminUserPublic[] = []
    for (const user of users) {
      createdUsers.push(await createAdminUser(user, tx))
    }

    return createdUsers
  })
}
