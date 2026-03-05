import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  Headers,
} from '@nestjs/common';

import { ValuationService } from './valuation.service';
import { SelectSurveyorDto } from './dto/select-surveyor.dto';

@Controller('valuation')
export class ValuationController {

  constructor(
    private readonly valuationService: ValuationService,
  ) {}

  // ================= SELECT SURVEYOR =================
  @Post('select-surveyor')
  async selectSurveyor(
    @Body() dto: SelectSurveyorDto,
  ) {
    return this.valuationService.selectSurveyor(dto);
  }

  // ================= STRIPE WEBHOOK =================
  @Post('webhook')
  async stripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
    @Res() res: any,
  ) {
    return this.valuationService.handleStripeWebhook(req, signature, res);
  }

  // ================= GET VALUATION =================
  @Get('application/:applicationId')
  async getByApplication(
    @Param('applicationId') applicationId: string,
  ) {
    return this.valuationService.getByApplication(applicationId);
  }

  // ================= CREATE VALUATION PAYMENT =================
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