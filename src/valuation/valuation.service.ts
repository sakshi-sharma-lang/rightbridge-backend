import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';

import { Valuation, ValuationDocument } from './schemas/valuation.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';

import { Counter } from '../payments/schemas/counter.schema';

@Injectable()
export class ValuationService {

  private stripe: Stripe;

  constructor(
    @InjectModel(Valuation.name)
    private valuationModel: Model<ValuationDocument>,

    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,

  @InjectModel(Counter.name)
  private counterModel: Model<Counter>, // ✅ required
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }

  // ================= SELECT SURVEYOR =================
  async selectSurveyor(data: any, userId: string) {

    if (!data.applicationId) {
      throw new BadRequestException('applicationId is required');
    }

    const valuation = await this.valuationModel.findOneAndUpdate(
      { applicationId: data.applicationId },
      {
        ...data,
        userId,
      },
      { new: true, upsert: true },
    );

    return valuation;
  }

  // ================= GET VALUATION =================
  async getByApplication(applicationId: string) {

    const valuation = await this.valuationModel
      .findOne({ applicationId })
      .lean();

    if (!valuation) {
      throw new NotFoundException('Valuation not found');
    }

    return {
      applicationId: valuation.applicationId,
      surveyorName: valuation.surveyorName,
      companyType: valuation.companyType,
      turnaroundTime: valuation.turnaroundTime,
      accreditation: valuation.accreditation,
     
      paymentStatus: valuation.paymentStatus || 'NOT_PAID',
      paymentIntentId: valuation.stripePaymentIntentId || null,
    };
  }

  // ================= CREATE PAYMENT =================
async createPayment(
  applicationId: string,
  surveyorId: string,
  currency: string,
  type: string,
  valuationFee: number,
) {

  if (!applicationId) {
    throw new BadRequestException('applicationId is required');
  }

  if (!surveyorId) {
    throw new BadRequestException('surveyorId is required');
  }

  const valuation = await this.valuationModel.findOne({ applicationId });

  if (!valuation) {
    throw new NotFoundException('Valuation not found');
  }

  /* DEFINE AMOUNT FROM BODY */

  const amount = Number(valuationFee);

  if (isNaN(amount) || amount <= 0) {
    throw new BadRequestException('Invalid valuation fee');
  }

  /* CHECK EXISTING PAYMENT */

  const existingPayment = await this.paymentModel.findOne({
    applicationId,
    surveyorId,
    type,
  });

  if (existingPayment?.stripePaymentIntentId) {

    const intent = await this.stripe.paymentIntents.retrieve(
      existingPayment.stripePaymentIntentId,
    );

    return {
      success: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      surveyorId,
      type,
      amount: intent.amount / 100,
      currency: intent.currency,
      status: intent.status,
    };
  }

  /* CREATE STRIPE PAYMENT */

  const intent = await this.stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    metadata: {
      applicationId,
      surveyorId,
      type,
    },
  });

  /* SAVE PAYMENT */
const payId = await this.generatePayId();

  await this.paymentModel.create({
    payId,
    applicationId,
    userId: valuation.userId,
    surveyorId,
    amount,  // saved as amount
    currency,
    type,
    stripePaymentIntentId: intent.id,
    status: intent.status,
  });

  return {
    success: true,
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    surveyorId,
    type,
    amount, // return amount instead of valuationFee
    currency,
    status: intent.status,
  };
}

private async generatePayId(): Promise<string> {
  const year = new Date().getFullYear();

  const counter = await this.counterModel.findOneAndUpdate(
    { name: `payment-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  return `PI-${year}-${counter.seq.toString().padStart(4, '0')}`;
}
}