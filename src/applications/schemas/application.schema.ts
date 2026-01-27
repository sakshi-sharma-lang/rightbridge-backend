import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';
import { ApplicationStatus } from '../enums/application-status.enum';


@Schema({ timestamps: true })
export class Application extends Document {

  /* ================= POPUP: LOAN TYPE ================= */
  @Prop(raw({
    applicationType: String,
    purposeOfLoan: String,
    fundUrgency: String,
    brokerReferralCode: String,
  }))
  loanType: Record<string, any>;

   @Prop({
    type: Number,
    required: false,
    min: 1,
  })
  numberOfApplicants: number;

    @Prop({
    type: Number,
    required: false,
    min: 1,
  })
  totalOwnershipShare: number;

  /* ================= POPUP + FORM: APPLICANT ================= */
@Prop({
  type: [
    {
      applyingAs: { type: String, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      // mobile: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      dateOfBirth: { type: String, required: false },
      nationality: { type: String, required: false },
      address: { type: String, required: true },
      postcode: { type: String, required: true },
      ownershipShare: { type: Number, required: true }, 
      ownershipRole: { type: String, required: true },  
      externalUserId: { type: String, required: false },
      
      
      timeAtAddress: {
        type: String,
        required: true,
        enum: ['Under 3 years', '3 years or more'],
      },

  
      // numberOfApplicants: {
      //   type: String,
      //   required: false,
      // },

      previousAddress: {
        previousResidentialAddress: { type: String },
        previousPostcode: { type: String },
      },

      companyAddress: { type: String },
      companyRegistrationNumber: { type: String },
    },
  ],
  required: true,
  validate: {
    validator: (v: any[]) => Array.isArray(v) && v.length > 0,
    message: 'At least one applicant is required',
  },
})
applicants: Record<string, any>[];
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
    solicitorFirmConfirmation: {
      type: Boolean,
      required: true,
    },
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

  @Prop({
  type: String,
  enum: Object.values(ApplicationStatus),
    required: true,

})
status: ApplicationStatus;



  @Prop({
    type: [String],
    default: [],
  })
  applicationStatus: string[];

@Prop({
  type: String,
  default: null,
})
rejectReason?: string;

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




commitment_fee: number;



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


@Prop({
  type: {
    creditCheckConsent: { type: Boolean, required: true },
    amlKycConsent: { type: Boolean, required: true },
    privacyPolicyConsent: { type: Boolean, required: true },
    marketingEmailConsent: { type: Boolean, default: false },
    marketingSmsConsent: { type: Boolean, default: false },
  },
})
declarationsAndConsent: {
  creditCheckConsent: boolean;
  amlKycConsent: boolean;
  privacyPolicyConsent: boolean;
  marketingEmailConsent?: boolean;
  marketingSmsConsent?: boolean;
};


  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true })
  userId: any;


}

export const ApplicationSchema =
  SchemaFactory.createForClass(Application);
