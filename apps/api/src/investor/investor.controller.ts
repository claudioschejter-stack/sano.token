import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InvestorService } from './investor.service';

class RepayMarginDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}

type AuthRequest = Request & { user?: { userId?: string; role?: string } };

@Controller('portfolio')
export class InvestorController {
  constructor(private readonly investorService: InvestorService) {}

  @Post('repay-margin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TREASURY', 'OPERATOR', 'INVESTOR')
  repayMargin(@Body() body: RepayMarginDto, @Req() req: AuthRequest) {
    const role = req.user?.role;
    const userId = req.user?.userId;
    if (role === 'INVESTOR' && userId) {
      return this.investorService.repayMarginWithAvailableCash(userId);
    }
    return this.investorService.repayMarginWithAvailableCash(body.userId);
  }

  @Get('cash-flow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TREASURY', 'OPERATOR', 'INVESTOR')
  getCashFlowHistory(@Req() req: AuthRequest) {
    const role = req.user?.role;
    const userId = req.user?.userId;
    if (role === 'INVESTOR' && userId) {
      return this.investorService.getCashFlowHistoryForUser(userId);
    }
    return this.investorService.getCashFlowHistory();
  }

  @Get(':wallet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'TREASURY', 'OPERATOR', 'INVESTOR')
  getPortfolio(@Param('wallet') wallet: string, @Req() req: AuthRequest) {
    const role = req.user?.role;
    if (role === 'INVESTOR' && req.user?.userId) {
      return this.investorService.getPortfolioForAuthenticatedUser(req.user.userId, wallet);
    }
    if (role === 'ADMIN' || role === 'TREASURY' || role === 'OPERATOR') {
      return this.investorService.getPortfolioByWallet(wallet);
    }
    throw new NotFoundException('Portfolio not available.');
  }
}
