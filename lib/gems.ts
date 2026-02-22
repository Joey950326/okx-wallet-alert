// 数字与枚举类型映射工具
// 将数字（1、2、3）映射为 gemsTypeEnum（GOLD_DOG / SILVER_DOG / BRONZE_DOG）

export type GemsType = 'GOLD_DOG' | 'SILVER_DOG' | 'BRONZE_DOG'

export const gemTypeMap: Record<number, GemsType> = {
  1: 'GOLD_DOG',
  2: 'SILVER_DOG',
  3: 'BRONZE_DOG',
}

export function gemTypeFromNumber(n: number): GemsType | undefined {
  return gemTypeMap[n]
}

export function gemTypeToNumber(t: GemsType): number | undefined {
  const entry = Object.entries(gemTypeMap).find(([, v]) => v === t)
  return entry ? Number(entry[0]) : undefined
}

// 简短示例
// gemTypeFromNumber(1) // -> 'GOLD_DOG'
// gemTypeToNumber('GOLD_DOG') // -> 1

export default {
  gemTypeFromNumber,
  gemTypeToNumber,
  gemTypeMap,
}
