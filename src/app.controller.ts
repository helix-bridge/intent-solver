import { Controller, Get, Logger } from '@nestjs/common';
import { AppService, QuoteInput } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  async postQuote() {
    const quoteInput: QuoteInput = {
      chainId: 1,
      userAddress: '0x9F33a4809aA708d7a399fedBa514e0A0d15EfA85',
      inputTokenAddress: '0x0000000000000000000000000000000000000000',
      inputTokenAmount: '10000000000000000000',
      outputTokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      slippageLimit: 0.005,
    };
    const quoteOutput = await this.appService.postQuote(quoteInput);
    return quoteOutput;
  }
}
