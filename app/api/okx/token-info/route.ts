import { NextResponse } from 'next/server'

import { getTokenInfoByAddress } from '@/lib/okx-wallet'
import { GetTokenInfoByAddressSchema } from '@/lib/schemas'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const chainIndex = searchParams.get('chainIndex')
    const tokenAddress = searchParams.get('tokenAddress')

    // Validate query params using Zod schema
    const paramsResult = GetTokenInfoByAddressSchema.safeParse({
      chainIndex,
      tokenAddress,
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

    const tokenInfo = await getTokenInfoByAddress({
      chainIndex: validatedParams.chainIndex,
      tokenAddress: validatedParams.tokenAddress,
    })

    return NextResponse.json({
      code: '0',
      msg: 'success',
      data: tokenInfo,
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
