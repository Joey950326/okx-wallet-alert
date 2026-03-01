import { NextResponse } from 'next/server'

import { getMarketCandles } from '@/lib/okx-wallet'
import { GetMarketCandlesSchema } from '@/lib/schemas'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const optionalParam = (key: string) => searchParams.get(key) ?? undefined

    const paramsResult = GetMarketCandlesSchema.safeParse({
      chainIndex: searchParams.get('chainIndex'),
      tokenContractAddress: searchParams.get('tokenContractAddress'),
      after: optionalParam('after'),
      before: optionalParam('before'),
      bar: optionalParam('bar'),
      limit: optionalParam('limit'),
    })

    if (!paramsResult.success) {
      const errors = paramsResult.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      return NextResponse.json(
        {
          code: '400',
          msg: `Invalid query parameters: ${errors}`,
          data: null,
        },
        { status: 400 }
      )
    }

    const validatedParams = paramsResult.data

    const data = await getMarketCandles({
      chainIndex: validatedParams.chainIndex,
      tokenContractAddress: validatedParams.tokenContractAddress,
      after: validatedParams.after,
      before: validatedParams.before,
      bar: validatedParams.bar,
      limit: validatedParams.limit,
    })

    return NextResponse.json({
      code: '0',
      msg: 'success',
      data,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('OKX') || message.includes('connect') ? 502 : 500

    return NextResponse.json(
      {
        code: String(status),
        msg: message,
        data: null,
      },
      { status }
    )
  }
}
