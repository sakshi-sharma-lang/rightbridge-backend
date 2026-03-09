import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  Headers,
  UseGuards,
  BadRequestException
} from '@nestjs/common';

import { ValuationService } from './valuation.service';
import { SelectSurveyorDto } from './dto/select-surveyor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('valuation')
export class ValuationController {
  constructor(
    private readonly valuationService: ValuationService,
  ) {}

  // ================= SELECT SURVEYOR =================
  @UseGuards(JwtAuthGuard)
 @UseGuards(JwtAuthGuard)
  @Post('select-surveyor')
  async selectSurveyor(
    @Req() req,
    @Body() body: any,
  ) {
    const userId = req.user.userId;

    return this.valuationService.selectSurveyor(body, userId);
  }
  // ================= STRIPE WEBHOOK (NO AUTH) =================

  // ================= GET VALUATION =================
  @UseGuards(JwtAuthGuard)
  @Get('application/:applicationId')
  async getByApplication(
    @Param('applicationId') applicationId: string,
  ) {
    return this.valuationService.getByApplication(applicationId);
  }

  // ================= CREATE VALUATION PAYMENT =================
@UseGuards(JwtAuthGuard)
@Post(':applicationId/surveyor/:surveyorId/payment')
async createPayment(
  @Param('applicationId') applicationId: string,
  @Param('surveyorId') surveyorId: string,
  @Body('currency') currency: string,
  @Body('type') type: string,
  @Body('valuationFee') valuationFee: number,
) {
  if (!currency) {
    throw new BadRequestException('currency is required');
  }

  if (!type) {
    throw new BadRequestException('type is required');
  }

  if (!valuationFee) {
    throw new BadRequestException('valuationFee is required');
  }

  return this.valuationService.createPayment(
    applicationId,
    surveyorId,
    currency,
    type,
    valuationFee,
  );
}


}