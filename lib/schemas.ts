import { z } from 'zod'

// ============================================================================
// OKX Token Info API
// ============================================================================

export const GetTokenInfoByAddressSchema = z.object({
  chainIndex: z
    .string()
    .trim()
    .min(1, 'chainIndex is required')
    .regex(/^\d+$/, 'chainIndex must be numeric'),
  tokenAddress: z.string().optional(),
})

export type GetTokenInfoByAddressInput = z.infer<typeof GetTokenInfoByAddressSchema>

// ============================================================================
// OKX Historical Price API
// ============================================================================

export const OkxPricePeriodSchema = z.enum(['1m', '5m', '30m', '1h', '1d'])

export type OkxPricePeriod = z.infer<typeof OkxPricePeriodSchema>

export const GetPriceByAddressSchema = z.object({
  chainIndex: z
    .string()
    .trim()
    .min(1, 'chainIndex is required')
    .regex(/^\d+$/, 'chainIndex must be numeric'),
  tokenAddress: z.string().optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
  begin: z.string().optional(),
  end: z.string().optional(),
  period: OkxPricePeriodSchema.optional(),
})

export type GetPriceByAddressInput = z.infer<typeof GetPriceByAddressSchema>

// ============================================================================
// OKX Market Candles API
// ============================================================================

export const OkxMarketCandleBarSchema = z.enum([
  '1s',
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1H',
  '2H',
  '4H',
  '6H',
  '12H',
  '1D',
  '1W',
  '1M',
  '3M',
  '6Hutc',
  '12Hutc',
  '1Dutc',
  '1Wutc',
  '1Mutc',
  '3Mutc',
])

export type OkxMarketCandleBar = z.infer<typeof OkxMarketCandleBarSchema>

export const GetMarketCandlesSchema = z.object({
  chainIndex: z
    .string()
    .trim()
    .min(1, 'chainIndex is required')
    .regex(/^\d+$/, 'chainIndex must be numeric'),
  tokenContractAddress: z.string().trim().min(1, 'tokenContractAddress is required'),
  after: z.string().optional(),
  before: z.string().optional(),
  bar: OkxMarketCandleBarSchema.optional(),
  limit: z
    .string()
    .optional()
    .refine((val) => {
      if (val === undefined) return true
      if (!/^\d+$/.test(val)) return false
      const num = Number(val)
      return num >= 1 && num <= 299
    }, 'limit must be an integer between 1 and 299'),
})

export type GetMarketCandlesInput = z.infer<typeof GetMarketCandlesSchema>

// ============================================================================
// Custom Monitor Storage
// ============================================================================

export const CustomMonitorTimeLevelSchema = z.enum(['FIVE_MINUTES', 'ONE_HOUR', 'ONE_DAY', 'ONE_WEEK'])

export type CustomMonitorTimeLevel = z.infer<typeof CustomMonitorTimeLevelSchema>

export const CustomMonitorRowSchema = z.object({
  id: z.string().min(1),
  address: z.string().min(1),
  name: z.string(),
  marketCap: z.string(),
  price: z.string(),
  timeValue: z.number().int().positive(),
  timeLevel: CustomMonitorTimeLevelSchema,
  signal: z.string(),
  signalTime: z.string(),
  createdAt: z.string(),
})

export type CustomMonitorRow = z.infer<typeof CustomMonitorRowSchema>

export const BuildCustomMonitorInputSchema = z.object({
  address: z.string().trim().min(1, 'address is required'),
  timeLevel: CustomMonitorTimeLevelSchema,
  timeValue: z.number().int().positive('timeValue must be a positive integer'),
})

export type BuildCustomMonitorInput = z.infer<typeof BuildCustomMonitorInputSchema>
