import { NextResponse } from 'next/server'

import { getPriceByAddress } from '@/lib/okx-wallet'
import { GetPriceByAddressSchema } from '@/lib/schemas'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Validate query params using Zod schema
    const paramsResult = GetPriceByAddressSchema.safeParse({
      chainIndex: searchParams.get('chainIndex'),
      tokenAddress: searchParams.get('tokenAddress'),
      limit: searchParams.get('limit'),
      cursor: searchParams.get('cursor'),
      begin: searchParams.get('begin'),
      end: searchParams.get('end'),
      period: searchParams.get('period'),
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

    const data = await getPriceByAddress({
      chainIndex: validatedParams.chainIndex,
      tokenAddress: validatedParams.tokenAddress,
      limit: validatedParams.limit,
      cursor: validatedParams.cursor,
      begin: validatedParams.begin,
      end: validatedParams.end,
      period: validatedParams.period,
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