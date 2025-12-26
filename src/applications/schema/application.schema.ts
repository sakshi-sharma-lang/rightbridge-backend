import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Application extends Document {

  @Prop(
    raw({
      applicationType: { type: String, required: true },
      purposeOfLoan: { type: String, required: true },
      fundUrgency: { type: String, required: true },
    }),
  )
  loanType: Record<string, any>;

  @Prop(
    raw({
      applyingAs: { type: String, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      mobile: { type: String, required: true },
      address: { type: String, required: true },
      postcode: { type: String, required: true },
      timeAtAddress: { type: String, required: true },
    }),
  )
  applicant: Record<string, any>;

  @Prop(
    raw({
      address: { type: String, required: true },
      postcode: { type: String, required: true },
      propertyType: { type: String, required: true },
      alreadyOwned: { type: Boolean, required: true },
      estimatedValue: { type: Number, required: true },
      rentalIncome: { type: Number, required: true },
    }),
  )
  property: Record<string, any>;

  @Prop(
    raw({
      loanAmount: { type: Number, required: true },
      purchasePrice: { type: Number, required: true },
      existingMortgage: { type: Number, required: true },
      refurbishmentCost: { type: Number, required: true },
      loanTerm: { type: String, required: true },
      interestPayment: { type: String, required: true },
    }),
  )
  loanRequirements: Record<string, any>;

  @Prop(
    raw({
      exitRoute: { type: String, required: true },
      exitTimeframe: { type: String, required: true },
      exitDescription: { type: String, required: true },
    }),
  )
  exitStrategy: Record<string, any>;

  @Prop(
    raw({
      firmName: { type: String, required: true },
      address: { type: String, required: true },
      email: { type: String, required: true },
      contactNumber: { type: String, required: true },
      contactName: { type: String, required: true },
    }),
  )
  solicitor: Record<string, any>;

  // ✅ ADD THIS BLOCK
  @Prop({
    type: [
      {
        key: { type: String },
        value: { type: Boolean },
      },
    ],
    default: [],
  })
  consents: {
    key: string;
    value: boolean;
  }[];

  @Prop({ default: 'submitted' })
  status: string;
}

export const ApplicationSchema =
  SchemaFactory.createForClass(Application);
