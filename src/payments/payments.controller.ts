import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  UseGuards,
  Param,
  HttpCode,
  Res,
  Headers,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';




@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /* ================= CREATE STRIPE INTENT ================= */
  @Post('create-intent')
  @UseGuards(JwtAuthGuard)
  async create(@Body('applicationId') applicationId: string, @Req() req: any) {
    return this.service.createPayment(applicationId, req.user.userId);
  }

  /* ================= PAYMENT DETAILS ================= */
  @Get('application/:applicationId')
  @UseGuards(JwtAuthGuard)
  async getPaymentDetails(
    @Param('applicationId') applicationId: string,
    @Req() req: any,
  ) {
    return this.service.getApplicationPaymentDetails(
      applicationId,
      req.user.userId,
    );
  }

  /* ================= STRIPE WEBHOOK ================= */
 @Post('webhook')
  async stripeWebhook(
    @Req() req: any,
    @Res() res: any,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.service.handleStripeWebhook(req, signature, res);
  }


    @Post('confirm')
  @UseGuards(JwtAuthGuard)
  async confirmPayment(
    @Body('paymentIntentId') paymentIntentId: string,
    @Req() req: any,
  ) {
    return this.service.confirmPayment(paymentIntentId, req.user.userId);
  }

 @Get('management')
  @UseGuards(JwtAuthGuard)
  async getPayments(@Query() query: any) {
    return this.service.getPaymentsManagement(query);
  }


}
