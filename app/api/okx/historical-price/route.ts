import { NextResponse } from 'next/server'

import { getPriceByAddress, type OkxPricePeriod } from '@/lib/okx-wallet'

export const runtime = 'nodejs'

const PERIODS: OkxPricePeriod[] = ['1m', '5m', '30m', '1h', '1d']

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const chainIndex = searchParams.get('chainIndex')
    const tokenAddress = searchParams.get('tokenAddress')
    const limit = searchParams.get('limit')
    const cursor = searchParams.get('cursor')
    const begin = searchParams.get('begin')
    const end = searchParams.get('end')
    const period = searchParams.get('period')

    if (!chainIndex) {
      return NextResponse.json(
        {
          code: '400',
          msg: 'Missing required query param: chainIndex',
          data: null,
        },
        { status: 400 }
      )
    }

    if (period && !PERIODS.includes(period as OkxPricePeriod)) {
      return NextResponse.json(
        {
          code: '400',
          msg: 'Invalid query param: period. Allowed values: 1m, 5m, 30m, 1h, 1d',
          data: null,
        },
        { status: 400 }
      )
    }

    const data = await getPriceByAddress({
      chainIndex,
      tokenAddress: tokenAddress ?? undefined,
      limit: limit ?? undefined,
      cursor: cursor ?? undefined,
      begin: begin ?? undefined,
      end: end ?? undefined,
      period: (period as OkxPricePeriod | null) ?? undefined,
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