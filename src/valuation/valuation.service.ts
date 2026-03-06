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
  async handleStripeWebhook(req: any, signature: string, res: any) {

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET as string,
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const intent = event.data.object as Stripe.PaymentIntent;

    try {

      switch (event.type) {

        case 'payment_intent.created':
          console.log('PaymentIntent created');
          break;

        case 'payment_intent.processing':

          await this.valuationModel.updateOne(
            { stripePaymentIntentId: intent.id },
            {
              $set: {
                paymentStatus: 'PROCESSING',
              },
            },
          );

          console.log('Payment processing');
          break;

        case 'payment_intent.succeeded':

          await this.valuationModel.updateOne(
            { stripePaymentIntentId: intent.id },
            {
              $set: {
                paymentStatus: 'PAID',
                paymentCompleted: true,
              },
            },
          );

          console.log('Payment succeeded');
          break;

        case 'payment_intent.payment_failed':

          await this.valuationModel.updateOne(
            { stripePaymentIntentId: intent.id },
            {
              $set: {
                paymentStatus: 'FAILED',
              },
            },
          );

          console.log('Payment failed');
          break;

        case 'payment_intent.canceled':

          await this.valuationModel.updateOne(
            { stripePaymentIntentId: intent.id },
            {
              $set: {
                paymentStatus: 'CANCELED',
              },
            },
          );

          console.log('Payment canceled');
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({ message: 'Webhook processing failed' });
    }

    return res.json({ received: true });
  }
}