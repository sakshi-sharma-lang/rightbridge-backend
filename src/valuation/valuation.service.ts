import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model , Types } from 'mongoose';
import Stripe from 'stripe';

import { Valuation, ValuationDocument } from './schemas/valuation.schema';

@Injectable()
export class ValuationService {

  private stripe: Stripe;

  constructor(
    @InjectModel(Valuation.name)
    private valuationModel: Model<ValuationDocument>,
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

    const valuation = await this.valuationModel.findOne({ applicationId }).lean();

    if (!valuation) {
      throw new NotFoundException('Valuation not found');
    }

    return {
      applicationId: valuation.applicationId,
      surveyorName: valuation.surveyorName,
      companyType: valuation.companyType,
      turnaroundTime: valuation.turnaroundTime,
      accreditation: valuation.accreditation,
      valuationFee: valuation.price,
      paymentStatus: valuation.paymentStatus || 'NOT_PAID',
      paymentIntentId: valuation.stripePaymentIntentId || null,
    };
  }



async createPayment(
  applicationId: string,
  surveyorId: string,
  currency: string,
  type: string,
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

  const amount = valuation.price;

  if (!amount) {
    throw new BadRequestException('Valuation price not set');
  }

  // Prevent duplicate PaymentIntent
  if (valuation.stripePaymentIntentId) {

    const intent = await this.stripe.paymentIntents.retrieve(
      valuation.stripePaymentIntentId,
    );

    return {
      success: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      surveyorId: valuation.surveyorId,
      type: valuation.type,
      amount: intent.amount / 100,
      currency: intent.currency,
      status: intent.status,
    };
  }

  const intent = await this.stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    metadata: {
      applicationId,
      surveyorId,
      type,
    },
  });

  valuation.surveyorId = surveyorId;
  valuation.type = type;
  valuation.stripePaymentIntentId = intent.id;
  valuation.paymentAmount = amount;
  valuation.paymentStatus = intent.status;

  await valuation.save();

  return {
    success: true,
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    surveyorId,
    type,
    amount,
    currency,
    status: intent.status,
  };
}
}
