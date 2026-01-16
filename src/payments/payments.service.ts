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
  // Try to find by MongoDB ObjectId first, then by appId
  let application;
  if (Types.ObjectId.isValid(applicationId)) {
    application = await this.applicationModel.findById(applicationId).lean();
  } else {
    // If not a valid ObjectId, try to find by appId
    application = await this.applicationModel.findOne({ appId: applicationId }).lean();
  }
 
  if (!application) {
    throw new BadRequestException('Application not found');
  }
 
  if (application.userId.toString() !== userId) {
    throw new ForbiddenException('Not allowed');
  }
 
  // Use default commitment fee of 500 if not set
  const commitmentFee = Number(application.commitment_fee) || 500;
 
  // 🔒 PREVENT DOUBLE PAYMENT - Use MongoDB _id for payment lookup
  const alreadyPaid = await this.paymentModel.findOne({
    applicationId: application._id,
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
  // Try to find by MongoDB ObjectId first, then by appId
  let application;
  if (Types.ObjectId.isValid(applicationId)) {
    application = await this.applicationModel.findById(applicationId).lean();
  } else {
    // If not a valid ObjectId, try to find by appId
    application = await this.applicationModel.findOne({ appId: applicationId }).lean();
  }
 
  if (!application) {
    throw new BadRequestException('Application not found');
  }
 
  if (application.userId.toString() !== userId) {
    throw new ForbiddenException('Access denied');
  }
 
  // Use default commitment fee of 500 if not set
  const commitmentFee = Number(application.commitment_fee) || 500;
 
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
  console.log('🔔 Stripe webhook hit');
  console.log('Headers signature:', signature);
  console.log('Raw body type:', typeof req.body);

  let event: Stripe.Event;

  // 🔐 STRIPE SIGNATURE VERIFICATION
  try {
    event = this.stripe.webhooks.constructEvent(
      req.body, // MUST be raw buffer
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed');
    console.error('Error message:', err.message);
    return res.status(400).json({ message: 'Invalid signature' });
  }

  console.log('✅ Webhook verified');
  console.log('Event ID:', event.id);
  console.log('Event Type:', event.type);
  console.log('Event Created:', new Date(event.created * 1000));

  const intent = event.data.object as Stripe.PaymentIntent;

  console.log('🔹 PaymentIntent Debug');
  console.log('Intent ID:', intent.id);
  console.log('Status:', intent.status);
  console.log('Amount:', intent.amount);
  console.log('Currency:', intent.currency);
  console.log('Metadata:', intent.metadata);

  try {
    switch (event.type) {
      case 'payment_intent.created': {
        console.log('➡️ Handling payment_intent.created');

        const result = await this.paymentModel.updateOne(
          { stripePaymentIntentId: intent.id },
          {
            $set: {
              applicationId: intent.metadata?.applicationId,
              userId: intent.metadata?.userId,
              amount: intent.amount / 100,
              status: 'PENDING',
            },
          },
          { upsert: true },
        );

        console.log('DB result:', result);
        break;
      }

      case 'payment_intent.processing': {
        console.log('➡️ Handling payment_intent.processing');

        const result = await this.paymentModel.updateOne(
          { stripePaymentIntentId: intent.id },
          { $set: { status: 'PROCESSING' } },
        );

        console.log('DB result:', result);
        break;
      }

      case 'payment_intent.succeeded': {
        console.log('➡️ Handling payment_intent.succeeded');

        const result = await this.paymentModel.updateOne(
          { stripePaymentIntentId: intent.id },
          {
            $set: {
              applicationId: intent.metadata?.applicationId,
              userId: intent.metadata?.userId,
              amount: intent.amount / 100,
              status: 'PAID',
            },
          },
          { upsert: true },
        );

        console.log('DB result:', result);
        break;
      }

      case 'payment_intent.payment_failed': {
        console.log('➡️ Handling payment_intent.payment_failed');
        console.log('Failure reason:', intent.last_payment_error);

        const result = await this.paymentModel.updateOne(
          { stripePaymentIntentId: intent.id },
          {
            $set: {
              applicationId: intent.metadata?.applicationId,
              userId: intent.metadata?.userId,
              amount: intent.amount / 100,
              status: 'FAILED',
            },
          },
          { upsert: true },
        );

        console.log('DB result:', result);
        break;
      }

      case 'payment_intent.canceled': {
        console.log('➡️ Handling payment_intent.canceled');

        const result = await this.paymentModel.updateOne(
          { stripePaymentIntentId: intent.id },
          { $set: { status: 'CANCELED' } },
        );

        console.log('DB result:', result);
        break;
      }

      default:
        console.warn('⚠️ Unhandled Stripe event type:', event.type);
    }
  } catch (dbError) {
    console.error('❌ Error while processing webhook event');
    console.error(dbError);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }

  console.log('✅ Webhook processed successfully');
  return res.json({ received: true });
}



async confirmPayment(paymentIntentId: string, userId: string) {
  // Retrieve payment intent from Stripe
  const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

  if (!intent) {
    throw new BadRequestException('Payment intent not found');
  }

  // Verify the payment intent belongs to the user
  if (intent.metadata.userId !== userId) {
    throw new ForbiddenException('Access denied');
  }

  // Check if payment already exists
  const existingPayment = await this.paymentModel.findOne({
    stripePaymentIntentId: paymentIntentId,
  });

  if (existingPayment) {
    return {
      statusCode: 200,
      message: 'Payment already recorded',
      data: existingPayment,
    };
  }

  // Save payment to database
  const payment = await this.paymentModel.create({
    applicationId: intent.metadata.applicationId,
    userId: intent.metadata.userId,
    amount: intent.amount / 100, // Convert from cents to pounds
    stripePaymentIntentId: intent.id,
    status: intent.status === 'succeeded' ? 'PAID' : 'PENDING',
  });

  // Update application status if payment succeeded
  if (intent.status === 'succeeded') {
    await this.applicationModel.findByIdAndUpdate(
      intent.metadata.applicationId,
      { status: 'payment_completed' },
    );
  }

  return {
    statusCode: 200,
    message: 'Payment confirmed and saved',
    data: payment,
  };
}


 
 
 
}