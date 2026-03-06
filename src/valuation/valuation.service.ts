import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

  // ================= CREATE VALUATION PAYMENT =================
  async createPayment(
    applicationId: string,
    surveyorId: string,
    currency: string,
  ) {

    const valuation = await this.valuationModel.findOne({ applicationId });

    if (!valuation) {
      throw new NotFoundException('Valuation not found');
    }

    const amount = valuation.price;

    if (!amount) {
      throw new BadRequestException('Valuation price not set');
    }

    // If payment already exists
    if (
      valuation.stripePaymentIntentId &&
      valuation.paymentStatus !== 'FAILED'
    ) {

      const intent = await this.stripe.paymentIntents.retrieve(
        valuation.stripePaymentIntentId,
      );

      return {
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        amount: intent.amount / 100,
        currency: intent.currency,
        status: intent.status,
      };
    }

    // Create Stripe payment intent
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: {
        applicationId: valuation.applicationId.toString(),
        surveyorId,
        type: 'VALUATION',
      },
    });

    valuation.stripePaymentIntentId = intent.id;
    valuation.paymentAmount = amount;
    valuation.paymentStatus = intent.status;

    await valuation.save();

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
      currency,
      status: intent.status,
    };
  }

  // ================= UPDATE PAYMENT STATUS =================
  async updatePayment(applicationId: string, paymentId: string) {

    return this.valuationModel.findOneAndUpdate(
      { applicationId },
      {
        paymentCompleted: true,
        paymentId,
        paymentStatus: 'PAID',
      },
      { new: true },
    );
  }

  // ================= STRIPE WEBHOOK =================
  
}