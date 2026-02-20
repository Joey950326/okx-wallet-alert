import { NextResponse } from 'next/server'

import { getTokenInfoByAddress } from '@/lib/okx-wallet'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const chainIndex = searchParams.get('chainIndex')
    const tokenAddressParam = searchParams.get('tokenAddress')

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

    const tokenInfo = await getTokenInfoByAddress({
      chainIndex, // solana: 501, 具体链的chainIndex可以参考OKX文档：https://web3.okx.com/zh-hans/build/docs/waas/walletapi-resources-supported-networks
      tokenAddress: tokenAddressParam ?? '',
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
