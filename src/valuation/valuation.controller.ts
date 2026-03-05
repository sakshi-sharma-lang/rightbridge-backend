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
  @Post('webhook')
  async stripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
    @Res() res: any,
  ) {
    return this.valuationService.handleStripeWebhook(req, signature, res);
  }

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
  createPayment(
    @Param('applicationId') applicationId: string,
    @Param('surveyorId') surveyorId: string,
    @Body('currency') currency: string,
  ) {
    return this.valuationService.createPayment(
      applicationId,
      surveyorId,
      currency,
    );
  }
}