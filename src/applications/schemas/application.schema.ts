import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { ApplicationStatus } from '../enums/application-status.enum';


@Schema({ timestamps: true })
export class Application extends Document {

  /* ================= POPUP: LOAN TYPE ================= */
  @Prop(raw({
    referralCode: String,
    applicationType: String,
    purposeOfLoan: String,
    fundUrgency: String,

  }))
  loanType: Record<string, any>;

  /* ================= POPUP + FORM: APPLICANT ================= */
  @Prop(raw({
    applyingAs: String,
    firstName: String,
    lastName: String,
    email: String,
    mobile: String,
    phoneNumber: String,
    dateOfBirth: String,
    nationality: String,
    address: String,
    postcode: String,
    timeAtAddress: {
    type: String,
    required: true,
  },

previousAddress: {
  previousResidentialAddress: {
    type: String,
    required: false,
  },
  previousPostcode: {
    type: String,
    required: false,
  },
},


  }))
  applicant: Record<string, any>;

  /* ================= POPUP + FORM: PROPERTY ================= */
  @Prop(raw({
    address: String,
    city: String,
    country: String,
    postcode: String,
    propertyType: String,
    propertyStatus: String,
    ownershipStatus: String,   // radio: owned by me / another entity / purchase
    estimatedValue: Number,
    rentalIncome: Number,
    purchasePrice: Number,
    hasOutstandingMortgage: String,   // Yes / No
    existingMortgageDetails: {
    lenderName: String,
    amountOutstanding: Number,
    paymentsUpToDate: String,       // Yes / No
    amountInArrears: Number,
  },
   entityDetails: {
    entityName: String,
    entityType: String,
    companyRegistrationNumber: String,
    registeredAddress: String,
    postcode: String,
  },

  }))


  property: Record<string, any>;



  /* ================= POPUP + FORM: LOAN ================= */
  @Prop(raw({
    loanAmount: Number,
    loanTerm: String,
    loanTermMonths: Number,
    loanPurpose: String,
    interestPaymentPreference: String,
    interestPaymentType: String,
    existingMortgage: Number,
    refurbishmentCost: Number,
    borrowerContribution: Number,
    additionalSecurity: String,
  }))
  loanRequirements: Record<string, any>;

  /* ================= FORM: FINANCIAL ================= */
  @Prop(raw({
    depositAmount: Number,
    sourceOfDeposit: String,
    annualIncome: Number,
    employmentStatus: String,
    otherMortgagedProperties: Boolean,
    adverseCreditHistory: Boolean,
  }))
  financialInfo: Record<string, any>;

  /* ================= POPUP + FORM: EXIT ================= */
  @Prop(raw({
    exitRoute: String,
    exitTimeframe: String,
    exitDescription: String,
  }))
  exitStrategy: Record<string, any>;

  /* ================= POPUP + FORM: SOLICITOR ================= */
  @Prop(raw({
    firmName: String,
    contactName: String,
    email: String,
    contactNumber: String,
    address: String,
    city: String,
    country: String,
    postcode: String,
  }))
  solicitor: Record<string, any>;

  /* ================= FORM: ADDITIONAL ================= */
  @Prop(raw({
    brokerReferralCode: String,
    urgency: String,
    howDidYouHear: String,
    additionalNotes: String,
  }))
  additionalInfo: Record<string, any>;

  /* ================= CONSENTS ================= */
  @Prop({
    type: [
      {
        key: String,
        value: Boolean,
      },
    ],
    default: [],
  })
  consents: { key: string; value: boolean }[];

  /* ================= STATUS ================= */
 /* ================= STATUS ================= */

  @Prop({
  type: String,
  enum: Object.values(ApplicationStatus),
  default: null,
})
status: ApplicationStatus;


// @Prop({
//   type: String,
//   enum: [
//     'welcome_stage',
//     'dip_stage',
//     'kyc_stage',
//     'valuation_stage',
//     'underwriting_stage',
//     'offersent_stage',
//     'completed_stage',
//     'decline',
//   ],
//   default: null,
// })
// status:
//   | 'welcome_stage'
//   | 'dip_stage'
//   | 'kyc_stage'
//   | 'valuation_stage'
//   | 'underwriting_stage'
//   | 'offersent_stage'
//   | 'completed_stage'
//   | 'decline';

  @Prop({ default: true })
  isDraft: boolean;

    @Prop({ unique: true })
    appId: string;

      @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  /* ================= PRIORITY ================= */
  @Prop({
    type: String,
    default: '',
  })
  priority: string;
  underwriter: string;


@Prop({
  type: [String],
  default: [],
})
application_stage_management: string[];


@Prop({
  type: [String],      // stores only file URLs
  default: [],
})
additionalInformationDocuments: string[];

@Prop({
  type: String,
  default: '',
})
additionalInformationText: string;


  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true })
  userId: any;
}

export const ApplicationSchema =
  SchemaFactory.createForClass(Application);
