import { Injectable, NotFoundException, ForbiddenException , BadRequestException} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from './schemas/application.schema';
import { Counter } from './schemas/counter.schema';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,

    @InjectModel(Counter.name)
    private readonly counterModel: Model<Counter>,
  ) {}

  /* ================= CREATE ================= */
 async create(body: any, userId: string): Promise<Application> {
  try {
    const existingApplication = await this.applicationModel.findOne({
      userId,
      status: 'welcome_stage',
    });

    if (existingApplication) {
      throw new BadRequestException(
        'You cannot create an application. Your application is already in progress.',
      );
    }

    const appId = await this.generateAppId();

    const applicant = body.applicant || {};
    const property = body.property || {};
    const loanRequirements = body.loanRequirements || {};
    const financialProfile = body.financialProfile || {};
    const solicitor = body.solicitor || {};
    const additionalInfo = body.additionalInfo || {};

    const application = new this.applicationModel({
      ...body, // keep as-is
      applicant: {
        applyingAs: applicant.applyingAs ?? '',
        firstName: applicant.firstName ?? '',
        lastName: applicant.lastName ?? '',
        email: applicant.email ?? '',
        mobile: applicant.mobile ?? '',
        address: applicant.address ?? '',
        postcode: applicant.postcode ?? '',
        timeAtAddress: applicant.timeAtAddress ?? '',
        phoneNumber: applicant.phoneNumber ?? '',
        dateOfBirth: applicant.dateOfBirth ?? '',
        nationality: applicant.nationality ?? '',
      },
      property: {
        address: property.address ?? '',
        city: property.city ?? '',
        country: property.country ?? '',
        postcode: property.postcode ?? '',
        propertyType: property.propertyType ?? '',
        propertyStatus: property.propertyStatus ?? '',
        ownershipStatus: property.ownershipStatus ?? '',
        estimatedValue: property.estimatedValue ?? '',
        rentalIncome: property.rentalIncome ?? '',
        purchasePrice: property.purchasePrice ?? '',
      },
      loanRequirements: {
        loanAmount: loanRequirements.loanAmount ?? '',
        loanTerm: loanRequirements.loanTerm ?? '',
        loanTermMonths: loanRequirements.loanTermMonths ?? '',
        loanPurpose: loanRequirements.loanPurpose ?? '',
        interestPaymentPreference: loanRequirements.interestPaymentPreference ?? '',
        interestPaymentType: loanRequirements.interestPaymentType ?? '',
        existingMortgage: loanRequirements.existingMortgage ?? '',
        refurbishmentCost: loanRequirements.refurbishmentCost ?? '',
        borrowerContribution: loanRequirements.borrowerContribution ?? '',
        additionalSecurity: loanRequirements.additionalSecurity ?? '',
      },
      financialProfile: {
        depositAmount: financialProfile.depositAmount ?? '',
        sourceOfDeposit: financialProfile.sourceOfDeposit ?? '',
        annualIncome: financialProfile.annualIncome ?? '',
        employmentStatus: financialProfile.employmentStatus ?? '',
        otherMortgagedProperties: financialProfile.otherMortgagedProperties ?? '',
        adverseCreditHistory: financialProfile.adverseCreditHistory ?? '',
      },
      solicitor: {
        firmName: solicitor.firmName ?? '',
        contactName: solicitor.contactName ?? '',
        email: solicitor.email ?? '',
        contactNumber: solicitor.contactNumber ?? '',
        address: solicitor.address ?? '',
        city: solicitor.city ?? '',
        country: solicitor.country ?? '',
        postcode: solicitor.postcode ?? '',
      },
      additionalInfo: {
        brokerReferralCode: additionalInfo.brokerReferralCode ?? '',
        urgency: additionalInfo.urgency ?? '',
        howDidYouHear: additionalInfo.howDidYouHear ?? '',
        additionalNotes: additionalInfo.additionalNotes ?? '',
      },
      appId,
      userId,
      isDraft: true,
    });

    return await application.save();

  } catch (error) {
    // ✅ SIMPLE ENUM ERROR HANDLING
    if (
      error?.name === 'ValidationError' &&
      error?.errors?.status
    ) {
      throw new BadRequestException('Invalid application status. Please select a valid status.');

    }

    throw error; // other errors unchanged
  }
}


  /* ================= GET ================= */
  async findById(id: string, userId: string): Promise<Application> {
    const app = await this.applicationModel.findOne({ _id: id, userId });
    if (!app) {
      throw new ForbiddenException(
        'You are not authorized to access this application',
      );
    }

    return app;
  }

  /* ================= UPDATE ================= */
  async update(id: string, body: any, userId: string): Promise<Application> {
    const updated = await this.applicationModel.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          ...body,
          isDraft: false,

        },
      },
      { new: true },
    );

    if (!updated) {
      throw new ForbiddenException(
        'You are not authorized to update this application',
      );
    }
    return updated;
  }

  // Update appliaction details frontend api application tabs
  async updateApplicationDetails(
  id: string,
  body: any,
  userId: string,
): Promise<Application> {
  const updated = await this.applicationModel.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        ...body,
        isDraft: false,
      },
    },
    { new: true },
  );

  if (!updated) {
    throw new ForbiddenException(
      'You are not authorized to update this application',
    );
  }

  return updated;
}


  /* ================= APP ID GENERATOR ================= */
  private async generateAppId(): Promise<string> {
    const year = new Date().getFullYear();

    const counter = await this.counterModel.findOneAndUpdate(
      { name: `application-${year}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    return `BL-${year}-${counter.seq.toString().padStart(4, '0')}`;
  }
 async getApplicationsAdmindashboard(query: any) {

  const {
    status,
    loanType,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 10,
  } = query;

  // ================= STATUS → UI LABEL MAP =================
  const STATUS_LABEL_MAP: Record<string, string> = {
    welcome_stage: 'Draft',
    dip_stage: 'DIP Submitted',
    kyc_stage: 'KYC Pending',
    valuation_stage: 'Valuation',
    underwriting_stage: 'Underwriting',
    offersent_stage: 'Offer Sent',
    completed_stage: 'Offer Accepted',
    decline_stage: 'DIP Declined',
  };

  // 🔒 BASE FILTER: ACTIVE applications are treated as NON-EXISTENT
  const baseFilter = {
    status: { $nin: ['welcome_stage'] },
    isDraft: { $ne: true },
  };

  // 🔒 MAIN FILTER (used for list + filtered total)
  const filter: any = { ...baseFilter };

  // ================= STATUS FILTER =================
  // NOTE: status=active is intentionally ignored
  if (status && status !== 'active') {
    filter.status = {
      $regex: `^${status.trim()}$`,
      $options: 'i',
    };
  }

  // ================= LOAN TYPE FILTER =================
  if (loanType) {
    filter['loanType.applicationType'] = loanType;
  }

  // ================= DATE FILTER (CREATED AT - LIST) =================
  if (fromDate || toDate) {
    filter.createdAt = {};

    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = start;
    }

    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // ================= CURRENT MONTH RANGE =================
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date();
  endOfMonth.setHours(23, 59, 59, 999);

  // ================= LAST MONTH RANGE =================
  const startOfLastMonth = new Date(startOfMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  const endOfLastMonth = new Date(startOfMonth);
  endOfLastMonth.setMilliseconds(-1);

// ================= SEARCH =================
if (search) {
  const raw = search.trim();
  const parts = raw.split(/\s+/);

  filter.$or = [
    { appId: { $regex: raw, $options: 'i' } },
    { 'property.address': { $regex: raw, $options: 'i' } },

    // full string in first or last name
    { 'applicant.firstName': { $regex: raw, $options: 'i' } },
    { 'applicant.lastName': { $regex: raw, $options: 'i' } },

    // Multi-word first name + last name
    ...(parts.length >= 2
      ? [{
          $and: [
            {
              'applicant.firstName': {
                $regex: parts.slice(0, -1).join(' '),
                $options: 'i',
              },
            },
            {
              'applicant.lastName': {
                $regex: parts[parts.length - 1],
                $options: 'i',
              },
            },
          ],
        }]
      : []),
  ];
}
  const skip = (Number(page) - 1) * Number(limit);
  // ================= TODAY RANGE =================
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // ================= QUERY =================
  const [
    rows,
    total,
    totalApplications,
    dipToday,
    awaitingFee,
    kycInProgress,
    underwritingQueue,
    offersIssued,
    thisMonthCount,
    lastMonthCount,
  ] = await Promise.all([

    // 🔹 LIST DATA (active excluded)
    this.applicationModel
      .find(filter)
      .select({
        appId: 1,
        status: 1,
        updatedAt: 1,
        'applicant.firstName': 1,
        'applicant.lastName': 1,
        'loanRequirements.loanAmount': 1,
        'property.address': 1,
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),

    // 🔹 FILTERED TOTAL (active excluded)
    this.applicationModel.countDocuments(filter),

    // 🔹 TOTAL APPLICATIONS (active excluded)
    this.applicationModel.countDocuments(baseFilter),

    // 🔹 DIP TODAY (active excluded)
    this.applicationModel.countDocuments({
      ...baseFilter,
      updatedAt: { $gte: startOfToday, $lte: endOfToday },
    }),

    // 🔹 STATUS COUNTS (your original logic untouched)
    this.applicationModel.countDocuments({ status: 'fee_required' }),
    this.applicationModel.countDocuments({ status: 'kyc_in_progress' }),
    this.applicationModel.countDocuments({ status: 'underwriting' }),
    this.applicationModel.countDocuments({ status: 'offer_issued' }),

    // 🔹 THIS MONTH COUNT (active excluded)
    this.applicationModel.countDocuments({
      ...baseFilter,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    }),

    // 🔹 LAST MONTH COUNT (active excluded)
    this.applicationModel.countDocuments({
      ...baseFilter,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    }),
  ]);

  // ================= FINAL CALCULATION =================
  const thisMonthChange = thisMonthCount - lastMonthCount;

  // ================= FORMAT TABLE =================
  const data = rows.map((item) => ({
    appId: item.appId,
    applicantName: `${item.applicant?.firstName ?? ''} ${item.applicant?.lastName ?? ''}`.trim(),
    loanAmount: item.loanRequirements?.loanAmount ?? 0,
    propertyAddress: item.property?.address ?? '',
    status: STATUS_LABEL_MAP[item.status] || item.status,   // 👈 UI label
    updatedAt: item.updatedAt,
  }));

  // ================= RESPONSE =================
  return {
    totalApplications,
    dipToday,
    awaitingFee,
    kycInProgress,
    underwritingQueue,
    offersIssued,
    thisMonthChange,
    total,
    page: Number(page),
    limit: Number(limit),
    data,
  };
}

  /* ================= ADMIN GET USER APPLICATION ================= */
  async findUserApplicationByIdForAdmin(id: string): Promise<Application> {
    const application = await this.applicationModel.findById(id);

    if (!application) {
      throw new NotFoundException('User application not found');
    }

    return application;
  }

  async getApplicationSummary(applicationId: string) {

    const application = await this.applicationModel
      .findById(applicationId)
      .select({
        appId: 1,
        status: 1,
        createdAt: 1,
        updatedAt:1,

        // Applicant
        'applicant.firstName': 1,
        'applicant.lastName': 1,
        'applicant.email': 1,

        // Loan
        'loanRequirements.loanAmount': 1,

        // Property
        'property.address': 1,
        'property.estimatedValue': 1,
      })
      .lean();

    if (!application) {
      throw new NotFoundException('Application not found');
    }
      
    const loanAmount = application.loanRequirements?.loanAmount ?? 0;
    const propertyValue = application.property?.estimatedValue ?? 0;
   const updatedAt=application.updatedAt?? 0;


    return {
      applicationId: application.appId,

      submittedDate: application.updatedAt
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(application.updatedAt))
    : null,

      status: application.status,
      //createdat: createdAt,

      applicant: {
        name: `${application.applicant?.firstName ?? ''} ${application.applicant?.lastName ?? ''}`.trim(),
        email: application.applicant?.email ?? '',
      },

      loan: {
        amount: loanAmount,
        propertyValue,
        ltv:
          loanAmount && propertyValue
            ? `${((loanAmount / propertyValue) * 100).toFixed(1)}%`
            : null,
      },

      property: {
        address: application.property?.address ?? '',
      },
    };
  }

  async getApplicationDetails(query: any) {
   

    const {
      status,
      loanType,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 10,
    } = query;

    // 🔒 BASE FILTER: ACTIVE applications are treated as NON-EXISTENT
    const baseFilter = { status: { $ne: 'active' } };

    // 🔒 MAIN FILTER (used for list + filtered total)
    const filter: any = { ...baseFilter };

    // ================= STATUS FILTER =================
    // NOTE: status=active is intentionally ignored
    if (status && status !== 'active') {
      filter.status = {
        $regex: `^${status.trim()}$`,
        $options: 'i',
      };
    }

    // ================= LOAN TYPE FILTER =================
    if (loanType) {
      filter['loanType.applicationType'] = loanType;
    }

    // ================= DATE FILTER (CREATED AT - LIST) =================
    if (fromDate || toDate) {
      filter.createdAt = {};

      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }

      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // ================= CURRENT MONTH RANGE =================
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setHours(23, 59, 59, 999);

    // ================= LAST MONTH RANGE =================
    const startOfLastMonth = new Date(startOfMonth);
    startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

    const endOfLastMonth = new Date(startOfMonth);
    endOfLastMonth.setMilliseconds(-1);

    // ================= SEARCH =================
    if (search) {
      filter.$or = [
        { appId: { $regex: search, $options: 'i' } },
        { 'applicant.firstName': { $regex: search, $options: 'i' } },
        { 'applicant.lastName': { $regex: search, $options: 'i' } },
        { 'property.address': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    // ================= TODAY RANGE =================
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // ================= QUERY =================
    const [
      rows,
      total,
      totalApplications,
      dipToday,
      awaitingFee,
      kycInProgress,
      underwritingQueue,
      offersIssued,
      thisMonthCount,
      lastMonthCount,
    ] = await Promise.all([

      // 🔹 LIST DATA (active excluded)
      this.applicationModel
        .find(filter)
        .select({
          appId: 1,
          status: 1,
          updatedAt: 1,
          'applicant.firstName': 1,
          'applicant.lastName': 1,
          'loanRequirements.loanAmount': 1,
          'property.address': 1,
        })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      // 🔹 FILTERED TOTAL (active excluded)
      this.applicationModel.countDocuments(filter),

      // 🔹 TOTAL APPLICATIONS (active excluded)
      this.applicationModel.countDocuments(baseFilter),

      // 🔹 DIP TODAY (active excluded)
      this.applicationModel.countDocuments({
        ...baseFilter,
        updatedAt: { $gte: startOfToday, $lte: endOfToday },
      }),

      // 🔹 STATUS COUNTS (already non-active)
      this.applicationModel.countDocuments({ status: 'fee_required' }),
      this.applicationModel.countDocuments({ status: 'kyc_in_progress' }),
      this.applicationModel.countDocuments({ status: 'underwriting' }),
      this.applicationModel.countDocuments({ status: 'offer_issued' }),

      // 🔹 THIS MONTH COUNT (active excluded)
      this.applicationModel.countDocuments({
        ...baseFilter,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),

      // 🔹 LAST MONTH COUNT (active excluded)
      this.applicationModel.countDocuments({
        ...baseFilter,
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }),
    ]);

    // ================= FINAL CALCULATION =================
    const thisMonthChange = thisMonthCount - lastMonthCount;

    // ================= FORMAT TABLE =================
    const data = rows.map((item) => ({
      appId: item.appId,
      applicantName: `${item.applicant?.firstName ?? ''} ${item.applicant?.lastName ?? ''}`.trim(),
      loanAmount: item.loanRequirements?.loanAmount ?? 0,
      propertyAddress: item.property?.address ?? '',
      status: item.status,
      updatedAt: item.updatedAt,
    }));

    // ================= RESPONSE =================
    return {
      // 🔹 DASHBOARD CARDS
      totalApplications,
      dipToday,
      awaitingFee,
      kycInProgress,
      underwritingQueue,
      offersIssued,

      // 🔹 MONTH CHANGE
      thisMonthChange,

      // 🔹 TABLE META
      total,
      page: Number(page),
      limit: Number(limit),

      // 🔹 TABLE DATA
      data,
    };
  }

  // async getAllApplicationsForAdmin(query: any) {
   

  //   const {
  //     status,
  //     loanType,
  //     fromDate,
  //     toDate,
  //     search,
  //     page = 1,
  //     limit = 10,
  //   } = query;

  //   // 🔒 BASE FILTER: ACTIVE applications are treated as NON-EXISTENT
  //   const baseFilter = { status: { $ne: 'active' } };

  //   // 🔒 MAIN FILTER (used for list + filtered total)
  //   const filter: any = { ...baseFilter };

  //   // ================= STATUS FILTER =================
  //   // NOTE: status=active is intentionally ignored
  //   if (status && status !== 'active') {
  //     filter.status = {
  //       $regex: `^${status.trim()}$`,
  //       $options: 'i',
  //     };
  //   }

  //   // ================= LOAN TYPE FILTER =================
  //   if (loanType) {
  //     filter['loanType.applicationType'] = loanType;
  //   }

  //   // ================= DATE FILTER (CREATED AT - LIST) =================
  //   if (fromDate || toDate) {
  //     filter.createdAt = {};

  //     if (fromDate) {
  //       const start = new Date(fromDate);
  //       start.setHours(0, 0, 0, 0);
  //       filter.createdAt.$gte = start;
  //     }

  //     if (toDate) {
  //       const end = new Date(toDate);
  //       end.setHours(23, 59, 59, 999);
  //       filter.createdAt.$lte = end;
  //     }
  //   }

  //   // ================= CURRENT MONTH RANGE =================
  //   const startOfMonth = new Date();
  //   startOfMonth.setDate(1);
  //   startOfMonth.setHours(0, 0, 0, 0);

  //   const endOfMonth = new Date();
  //   endOfMonth.setHours(23, 59, 59, 999);

  //   // ================= LAST MONTH RANGE =================
  //   const startOfLastMonth = new Date(startOfMonth);
  //   startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  //   const endOfLastMonth = new Date(startOfMonth);
  //   endOfLastMonth.setMilliseconds(-1);

  //   // ================= SEARCH =================
  //   if (search) {
  //     filter.$or = [
  //       { appId: { $regex: search, $options: 'i' } },
  //       { 'applicant.firstName': { $regex: search, $options: 'i' } },
  //       { 'applicant.lastName': { $regex: search, $options: 'i' } },
  //       { 'property.address': { $regex: search, $options: 'i' } },
  //     ];
  //   }

  //   const skip = (Number(page) - 1) * Number(limit);

  //   // ================= TODAY RANGE =================
  //   const startOfToday = new Date();
  //   startOfToday.setHours(0, 0, 0, 0);

  //   const endOfToday = new Date();
  //   endOfToday.setHours(23, 59, 59, 999);

  //   // ================= QUERY =================
  //   const [
  //     rows,
  //     total,
  //     totalApplications,
  //     dipToday,
  //     awaitingFee,
  //     kycInProgress,
  //     underwritingQueue,
  //     offersIssued,
  //     thisMonthCount,
  //     lastMonthCount,
  //   ] = await Promise.all([

  //     // 🔹 LIST DATA (active excluded)
  //     this.applicationModel
  //       .find(filter)
  //       .select({
  //         appId: 1,
  //         status: 1,
  //         updatedAt: 1,
  //         'applicant.firstName': 1,
  //         'applicant.lastName': 1,
  //         'loanRequirements.loanAmount': 1,
  //         'property.address': 1,
  //       })
  //       .sort({ updatedAt: -1 })
  //       .skip(skip)
  //       .limit(Number(limit))
  //       .lean(),

  //     // 🔹 FILTERED TOTAL (active excluded)
  //     this.applicationModel.countDocuments(filter),

  //     // 🔹 TOTAL APPLICATIONS (active excluded)
  //     this.applicationModel.countDocuments(baseFilter),

  //     // 🔹 DIP TODAY (active excluded)
  //     this.applicationModel.countDocuments({
  //       ...baseFilter,
  //       updatedAt: { $gte: startOfToday, $lte: endOfToday },
  //     }),

  //     // 🔹 STATUS COUNTS (already non-active)
  //     this.applicationModel.countDocuments({ status: 'fee_required' }),
  //     this.applicationModel.countDocuments({ status: 'kyc_in_progress' }),
  //     this.applicationModel.countDocuments({ status: 'underwriting' }),
  //     this.applicationModel.countDocuments({ status: 'offer_issued' }),

  //     // 🔹 THIS MONTH COUNT (active excluded)
  //     this.applicationModel.countDocuments({
  //       ...baseFilter,
  //       createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  //     }),

  //     // 🔹 LAST MONTH COUNT (active excluded)
  //     this.applicationModel.countDocuments({
  //       ...baseFilter,
  //       createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  //     }),
  //   ]);

  //   // ================= FINAL CALCULATION =================
  //   const thisMonthChange = thisMonthCount - lastMonthCount;

  //   // ================= FORMAT TABLE =================
  //   const data = rows.map((item) => ({
  //     appId: item.appId,
  //     applicantName: `${item.applicant?.firstName ?? ''} ${item.applicant?.lastName ?? ''}`.trim(),
  //     loanAmount: item.loanRequirements?.loanAmount ?? 0,
  //     propertyAddress: item.property?.address ?? '',
  //     status: item.status,

  //     updatedAt: item.updatedAt,
  //   }));

  //   // ================= RESPONSE =================
  //   return {
  //     // 🔹 DASHBOARD CARDS
  //     totalApplications,
  //     dipToday,
  //     awaitingFee,
  //     kycInProgress,
  //     underwritingQueue,
  //     offersIssued,

  //     // 🔹 MONTH CHANGE
  //     thisMonthChange,

  //     // 🔹 TABLE META
  //     total,
  //     page: Number(page),
  //     limit: Number(limit),

  //     // 🔹 TABLE DATA
  //     data,
  //   };
  // }

  async getAllApplicationbyAdmin(query: any) {
    const {
      status,
      priority,
      underwriter,
      loanType,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 10,
      sort = 'recent', // recent | oldest | highest_amount | lowest_amount | priority
    } = query;


    const STATUS_LABEL_MAP: Record<string, string> = {
    welcome_stage: 'Draft',
    dip_stage: 'DIP Submitted',
    kyc_stage: 'KYC Pending',
    valuation_stage: 'Valuation',
    underwriting_stage: 'Underwriting',
    offersent_stage: 'Offer Sent',
    completed_stage: 'Offer Accepted',
    decline_stage: 'DIP Declined',
  };


    // ================= BASE FILTER =================
      const baseFilter = {
      status: { $nin: ['welcome_stage'] },
      isDraft: { $ne: true },
    };

    const filter: any = { ...baseFilter };

    // ================= STATUS FILTER =================
    if (status && status !== 'all') {
      filter.status = status;
    }

    // ================= PRIORITY FILTER =================
    if (priority) {
      filter.priority = priority;
    }

    // ================= LOAN TYPE FILTER =================
    if (loanType) {
      filter['loanType.applicationType'] = loanType;
    }

    // ================= DATE FILTER =================
    if (fromDate || toDate) {
      filter.createdAt = {};

      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }

      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

// ================= SEARCH =================
if (search) {
  const raw = search.trim();
  const parts = raw.split(/\s+/);

  filter.$or = [
    { appId: { $regex: raw, $options: 'i' } },
    { 'property.address': { $regex: raw, $options: 'i' } },

    // full string in first or last name
    { 'applicant.firstName': { $regex: raw, $options: 'i' } },
    { 'applicant.lastName': { $regex: raw, $options: 'i' } },

    // Multi-word first name + last name
    ...(parts.length >= 2
      ? [{
          $and: [
            {
              'applicant.firstName': {
                $regex: parts.slice(0, -1).join(' '),
                $options: 'i',
              },
            },
            {
              'applicant.lastName': {
                $regex: parts[parts.length - 1],
                $options: 'i',
              },
            },
          ],
        }]
      : []),
  ];
}


    // ================= SORT =================
    let sortQuery: any = { updatedAt: -1 };

    if (sort === 'oldest') sortQuery = { updatedAt: 1 };
    if (sort === 'highest_amount') sortQuery = { 'loanRequirements.loanAmount': -1 };
    if (sort === 'lowest_amount') sortQuery = { 'loanRequirements.loanAmount': 1 };
    if (sort === 'priority') sortQuery = { priority: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    // ================= DASHBOARD FILTER =================
    const dashboardFilter = { ...filter };
    delete dashboardFilter.$or; // cards ignore search

    // ================= QUERY =================
    const [
      rows,
      total,

      totalApplications,
      awaitingFee,
      kycInProgress,
      underwritingQueue,
      offersIssued,
    ] = await Promise.all([

      // -------- TABLE DATA --------
      this.applicationModel
        .find(filter)
        .select({
          _id: 1, 
          appId: 1,
          status: 1,
          priority: 1,
          updatedAt: 1,
          'applicant.firstName': 1,
          'applicant.lastName': 1,
          'loanRequirements.loanAmount': 1,
          'property.address': 1,
        })
        .sort(sortQuery)
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      // -------- TABLE TOTAL --------
      this.applicationModel.countDocuments(filter),

      // -------- DASHBOARD COUNTS (STATUS-AWARE) --------
      this.applicationModel.countDocuments(dashboardFilter),

      this.applicationModel.countDocuments({
        ...dashboardFilter,
        status: 'fee_required',
      }),

      this.applicationModel.countDocuments({
        ...dashboardFilter,
        status: 'kyc_in_progress',
      }),

      this.applicationModel.countDocuments({
        ...dashboardFilter,
        status: 'underwriting',
      }),

      this.applicationModel.countDocuments({
        ...dashboardFilter,
        status: 'offer_issued',
      }),
    ]);

    // ================= DASHBOARD CALC =================
    const inProgress = kycInProgress + underwritingQueue;
    const pendingAction = awaitingFee;
    const completed = offersIssued;

    // ================= TABLE FORMAT =================
    const data = rows.map((item) => ({
      id: item._id,
      appId: item.appId,
      applicantName: `${item.applicant?.firstName ?? ''} ${item.applicant?.lastName ?? ''}`.trim(),
      loanAmount: item.loanRequirements?.loanAmount ?? 0,
      propertyAddress: item.property?.address ?? '',
      status: STATUS_LABEL_MAP[item.status] || item.status,
      priority: item.priority ?? 'high',
      underwriter: item.underwriter ?? '',

      updatedAt: item.updatedAt,
    }));

    // ================= RESPONSE =================
    return {
      // 🔹 DASHBOARD
      totalApplications,
      inProgress,
      pendingAction,
      completed,

      // 🔹 TABLE META
      total,
      page: Number(page),
      limit: Number(limit),

      // 🔹 TABLE DATA
      data,
    };
  }
  async findApplicationByUserId(userId: string) {
    return this.applicationModel.findOne({ userId });
  }


}
