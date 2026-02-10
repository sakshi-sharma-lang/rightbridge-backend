import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Res,
  Headers,
  HttpCode,
  InternalServerErrorException,
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
  let application;

  if (Types.ObjectId.isValid(applicationId)) {
    application = await this.applicationModel.findById(applicationId).lean();
  } else {
    application = await this.applicationModel.findOne({ appId: applicationId }).lean();
  }

  if (!application) {
    throw new BadRequestException('Application not found');
  }

  if (application.userId.toString() !== userId) {
    throw new ForbiddenException('Not allowed');
  }

  const commitmentFee = Number(application.commitment_fee) || 500;

  // 🔎 check existing payment
  const existingPayment = await this.paymentModel.findOne({
    applicationId: application._id,
  });

  // ================= IF EXISTS =================
  if (existingPayment?.stripePaymentIntentId) {

    const stripeIntent = await this.stripe.paymentIntents.retrieve(
      existingPayment.stripePaymentIntentId,
    );

    // ⭐ update status from stripe
    await this.paymentModel.updateOne(
      { _id: existingPayment._id },
      { status: stripeIntent.status },
    );

    return {
      statusCode: 200,
      message: 'Existing payment intent',
      data: {
        clientSecret: stripeIntent.client_secret,
        paymentIntentId: stripeIntent.id,
        stripeStatus: stripeIntent.status,
        amount: stripeIntent.amount / 100,
        currency: stripeIntent.currency,
      },
    };
  }

  // ================= CREATE NEW =================
  const intent = await this.stripe.paymentIntents.create({
    amount: commitmentFee * 100,
    currency: 'gbp',
    metadata: {
      applicationId: application._id.toString(),
      userId,
    },
  });

  // ⭐ save only schema fields
  await this.paymentModel.create({
    applicationId: application._id,
    userId,
    amount: commitmentFee,
    stripePaymentIntentId: intent.id,
    status: intent.status, // exact stripe status
  });

  // ⭐ send full data to frontend
  return {
    statusCode: 201,
    message: 'Payment intent created',
    data: {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      stripeStatus: intent.status,
      amount: intent.amount / 100,
      currency: intent.currency,
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


 /* ================= GET PAYMENTS MANAGEMENT ================= */


async getPaymentsManagement(query: {
  page?: string;
  limit?: string;
  status?: string;
  type?: string;
  dateRange?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  appId?: string; // filter by application appId
}) {
  try {
    /* =====================================================
       PAGINATION (SAFE)
    ===================================================== */
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.max(Number(query.limit || 10), 1);
    const skip = (page - 1) * limit;

    const match: any = {};

    /* =====================================================
       APPLICATION FILTER (BY appId)
    ===================================================== */
    if (query.appId) {
      const application = await this.applicationModel
        .findOne({ appId: query.appId })
        .select('_id appId')
        .lean();

      if (!application) {
        match._id = null; // valid request, no data
      } else {
        match.applicationId = application._id.toString();
      }
    }

    /* =====================================================
       TYPE FILTER (STRICT VALIDATION – STATIC DATA)
    ===================================================== */
    if (query.type) {
      const allowedTypes = ['all', 'commitment', 'facility', 'other'];

      if (!allowedTypes.includes(query.type)) {
        throw new BadRequestException(
          `Invalid type. Allowed values: ${allowedTypes.join(', ')}`
        );
      }

      if (query.type === 'facility' || query.type === 'other') {
        match._id = null; // force empty result
      }
    }

    /* =====================================================
       STATUS FILTER (STRICT)
    ===================================================== */
    if (query.status) {
      const allowedStatuses = ['completed', 'pending', 'failed'];

      if (!allowedStatuses.includes(query.status)) {
        throw new BadRequestException(
          `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
        );
      }

      if (query.status === 'completed') {
        match.status = 'PAID';
      } else if (query.status === 'pending') {
        match.status = { $in: ['PENDING', 'PROCESSING'] };
      } else if (query.status === 'failed') {
        match.status = { $in: ['FAILED', 'CANCELED'] };
      }
    }

    /* =====================================================
       DATE RANGE FILTER (UI DROPDOWN)
    ===================================================== */
    if (query.dateRange) {
      const allowedRanges = ['today', 'week', 'month', 'all'];

      if (!allowedRanges.includes(query.dateRange)) {
        throw new BadRequestException(
          `Invalid dateRange. Allowed values: ${allowedRanges.join(', ')}`
        );
      }

      if (query.dateRange !== 'all') {
        const now = new Date();
        let from: Date;

        if (query.dateRange === 'today') {
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (query.dateRange === 'week') {
          const day = now.getDay() || 7;
          from = new Date(now);
          from.setDate(now.getDate() - day + 1);
          from.setHours(0, 0, 0, 0);
        } else {
          from = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        match.createdAt = { $gte: from, $lte: now };
      }
    }

    /* =====================================================
       CUSTOM DATE RANGE
    ===================================================== */
    if (!query.dateRange && (query.fromDate || query.toDate)) {
      match.createdAt = {};

      if (query.fromDate) {
        const from = new Date(query.fromDate);
        if (isNaN(from.getTime())) {
          throw new BadRequestException('Invalid fromDate');
        }
        match.createdAt.$gte = from;
      }

      if (query.toDate) {
        const to = new Date(query.toDate);
        if (isNaN(to.getTime())) {
          throw new BadRequestException('Invalid toDate');
        }
        match.createdAt.$lte = to;
      }
    }

    /* =====================================================
       SEARCH FILTER
    ===================================================== */
    if (query.search) {
      match.$or = [
        { stripePaymentIntentId: { $regex: query.search, $options: 'i' } },
        { applicationId: { $regex: query.search, $options: 'i' } },
        { userId: { $regex: query.search, $options: 'i' } },
      ];
    }

    /* =====================================================
       DASHBOARD SUMMARY (GLOBAL – UNCHANGED)
    ===================================================== */
    const [
      totalPaidAgg,
      successful,
      pending,
      failed,
    ] = await Promise.all([
      this.paymentModel.aggregate([
        { $match: { status: 'PAID' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.paymentModel.countDocuments({ status: 'PAID' }),
      this.paymentModel.countDocuments({
        status: { $in: ['PENDING', 'PROCESSING'] },
      }),
      this.paymentModel.countDocuments({
        status: { $in: ['FAILED', 'CANCELED'] },
      }),
    ]);

    const totalPayments = totalPaidAgg[0]?.total || 0;

    /* =====================================================
       LIST QUERY
    ===================================================== */
    const payments = await this.paymentModel
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalRecords = await this.paymentModel.countDocuments(match);

    /* =====================================================
       FETCH APPLICATION appId ONLY
    ===================================================== */
    const applicationIds = [
      ...new Set(
        payments.map(p => p.applicationId?.toString()).filter(Boolean)
      ),
    ];

    const applications = await this.applicationModel
      .find({ _id: { $in: applicationIds } })
      .select('_id appId')
      .lean();

    const applicationMap = new Map(
      applications.map(app => [app._id.toString(), app.appId])
    );

    /* =====================================================
       FINAL LIST (FLAT appId ONLY)
    ===================================================== */
    const list = payments.map(p => ({
      ...p,
      appId: applicationMap.get(p.applicationId?.toString()) || null,
      type: 'Commitment Fee',
      provider: 'Stripe',
    }));

    return {
      statusCode: 200,
      message: 'Payments fetched successfully',
      data: {
        summary: {
          totalPayments,
          successful,
          pending,
          failed,
        },
        list,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
        },
      },
    };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }

    console.error('Payments management error:', error);
    throw new InternalServerErrorException('Failed to fetch payments');
  }
}





}
