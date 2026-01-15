import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Res,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';

import { Payment } from './schemas/payment.schema';
import { Application } from '../applications/schemas/application.schema';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<Payment>,

    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }

  /* ================= CREATE STRIPE PAYMENT ================= */
/* ================= CREATE STRIPE PAYMENT ================= */
async createPayment(applicationId: string, userId: string) {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new BadRequestException('Invalid application id');
  }

  const application = await this.applicationModel.findById(applicationId).lean();

  if (!application) {
    throw new BadRequestException('Application not found');
  }

  if (application.userId.toString() !== userId) {
    throw new ForbiddenException('Not allowed');
  }

  const commitmentFee = Number(application.commitment_fee);

  if (!commitmentFee || commitmentFee <= 0) {
    throw new BadRequestException('Commitment fee not set');
  }

  // 🔒 PREVENT DOUBLE PAYMENT
  const alreadyPaid = await this.paymentModel.findOne({
    applicationId,
    status: 'PAID',
  });

  if (alreadyPaid) {
    throw new BadRequestException('Payment already completed');
  }

  const intent = await this.stripe.paymentIntents.create({
    amount: commitmentFee * 100, // Stripe expects smallest currency unit
    currency: 'gbp',
    metadata: {
      applicationId: application._id.toString(),
      userId,
    },
  });

  return {
    statusCode: 201,
    message: 'Payment intent created',
    data: {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    },
  };
}


/* ================= PAYMENT DETAILS ================= */
async getApplicationPaymentDetails(applicationId: string, userId: string) {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new BadRequestException('Invalid application id');
  }

  const application = await this.applicationModel.findById(applicationId).lean();

  if (!application) {
    throw new BadRequestException('Application not found');
  }

  if (application.userId.toString() !== userId) {
    throw new ForbiddenException('Access denied');
  }

  const commitmentFee = Number(application.commitment_fee);

  if (!commitmentFee || commitmentFee <= 0) {
    throw new BadRequestException('Commitment fee is required');
  }

  return {
    statusCode: 200,
    message: 'Application payment details',
    data: {
      applicationId: application._id,
      amount: commitmentFee,
      userId,
    },
  };
}


async handleStripeWebhook(req: any, signature: string, res: any) {
  let event: Stripe.Event;

  try {
    event = this.stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Invalid Stripe webhook signature',
      data: null,
    });
  }

  // ✅ PAYMENT SUCCESS
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;

    await this.paymentModel.create({
      applicationId: intent.metadata.applicationId,
      userId: intent.metadata.userId,
      amount: intent.amount / 100,
      stripePaymentIntentId: intent.id,
      status: 'PAID',
    });

    await this.applicationModel.findByIdAndUpdate(
      intent.metadata.applicationId,
      { status: 'payment_completed' },
    );
  }

  // ✅ PAYMENT FAILED
  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;

    await this.paymentModel.create({
      applicationId: intent.metadata.applicationId,
      userId: intent.metadata.userId,
      amount: intent.amount / 100,
      stripePaymentIntentId: intent.id,
      status: 'FAILED',
    });
  }

  return res.json({
    statusCode: 200,
    message: 'Stripe webhook processed successfully',
    data: null,
  });
}



}
