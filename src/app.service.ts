import { Injectable, Logger } from '@nestjs/common';
import { HelixChain } from '@helixbridge/helixconf';
import axios from 'axios';

enum ProtocolName {
  'odos' = 'odos',
  'kyber' = 'kyber',
}

export class QuoteBase {
  chainId: number;
  userAddress: string;
}

export class QuoteInput extends QuoteBase {
  inputTokenAddress: string;
  inputTokenAmount: string;
  outputTokenAddress: string;
  // 0.003 = 0.3%
  slippageLimit: number;
}

export class QuoteOutput extends QuoteBase {
  protocolName: ProtocolName;
  outputTokenAddress: string;
  outputAmount: string;
  gasEstimate: number;
  // USD value, 1 = 1 USD
  gasEstimateUsd: number;
  // output value in USD, after deducting gas fees
  netOutputUsd: number;
  rawData: object;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  async postQuote(quoteInput: QuoteInput): Promise<QuoteOutput> {
    return await this.odosQuote(quoteInput);
  }

  async odosQuote(quoteInput: QuoteInput): Promise<QuoteOutput> {
    const quoteUrl = `https://api.odos.xyz/sor/quote/v2`;
    const quoteRequestBody = {
      chainId: quoteInput.chainId, // Replace with desired chainId
      inputTokens: [
        {
          tokenAddress: quoteInput.inputTokenAddress, // checksummed input token address
          amount: quoteInput.inputTokenAmount, // input amount as a string in fixed integer precision
        },
      ],
      outputTokens: [
        {
          tokenAddress: quoteInput.outputTokenAddress, // checksummed output token address
          proportion: 1,
        },
      ],
      userAddr: quoteInput.userAddress, // checksummed user address
      slippageLimitPercent: quoteInput.slippageLimit * 100, // set your slippage limit percentage (1 = 1%),
      // https://docs.odos.xyz/product/sor/v2/referral-code
      referralCode: 0, // referral code (recommended)
      disableRFQs: true,
      compact: true,
    };

    try {
      const response = await axios.post(quoteUrl, quoteRequestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const quote = await response.data;
      this.logger.error('ODOS quote:', quote);
      // handle quote response data
      return {
        chainId: quoteInput.chainId,
        userAddress: quoteInput.userAddress,
        protocolName: ProtocolName.odos,
        outputTokenAddress: quote.outTokens[0],
        outputAmount: quote.outAmounts[0],
        netOutputUsd: quote.netOutValue,
        gasEstimate: quote.gasEstimate,
        gasEstimateUsd: quote.gasEstimateValue,
        rawData: quote,
      };
    } catch (error) {
      this.logger.error(`ODOS quote ERROR: ${error.message}`);
      return null;
    }
  }

  // https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps
  async kyberQuote(quoteInput: QuoteInput): Promise<QuoteOutput> {
    quoteInput.inputTokenAddress = quoteInput.inputTokenAddress.replace(
      '0x0000000000000000000000000000000000000000',
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    );
    quoteInput.outputTokenAddress = quoteInput.outputTokenAddress.replace(
      '0x0000000000000000000000000000000000000000',
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    );
    const quoteUrl = `https://aggregator-api.kyberswap.com/${HelixChain.get(quoteInput.chainId).code}/api/v1/routes?tokenIn=${quoteInput.inputTokenAddress}&tokenOut=${quoteInput.outputTokenAddress}&amountIn=${quoteInput.inputTokenAmount}&gasInclude=1`;
    this.logger.error('quoteUrl', quoteUrl);
    try {
      const response = await axios.get(quoteUrl);

      const quote = await response.data;
      this.logger.error('Kyber quote:', quote);
      if (quote.code == 0) {
        const _quote = quote.data.routeSummary;
        return {
          chainId: quoteInput.chainId,
          userAddress: quoteInput.userAddress,
          protocolName: ProtocolName.kyber,
          outputTokenAddress: _quote.tokenOut.replace(
            '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            '0x0000000000000000000000000000000000000000',
          ),
          outputAmount: _quote.amountOut,
          gasEstimate: _quote.gas,
          gasEstimateUsd: Number(_quote.gasUsd),
          netOutputUsd: Number(_quote.amountOutUsd) - Number(_quote.gasUsd),
          rawData: _quote,
        };
      } else {
        this.logger.error(`Kyber quote ERROR: ${quote.code}, ${quote.message}`);
      }
    } catch (error) {
      this.logger.error(`Kyber quote ERROR: ${error.message}`);
      return null;
    }
  }
}
