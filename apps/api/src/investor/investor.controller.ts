import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InvestorService } from './investor.service';

class RepayMarginDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}

@Controller('portfolio')
export class InvestorController {
  constructor(private readonly investorService: InvestorService) {}

  @Post('repay-margin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ADVISOR_MANAGER', 'ADVISOR', 'TREASURY', 'OPERATOR', 'INVESTOR')
  repayMargin(@Body() body: RepayMarginDto) {
    return this.investorService.repayMarginWithAvailableCash(body.userId);
  }

  @Get('cash-flow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ADVISOR_MANAGER', 'ADVISOR', 'TREASURY', 'OPERATOR', 'INVESTOR')
  getCashFlowHistory() {
    return this.investorService.getCashFlowHistory();
  }

  @Get(':wallet')
  getPortfolio(@Param('wallet') wallet: string) {
    return this.investorService.getPortfolioByWallet(wallet);
  }
}
