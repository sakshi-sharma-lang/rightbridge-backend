import { Injectable, NotFoundException, ForbiddenException , BadRequestException ,   InternalServerErrorException, } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model , Types } from 'mongoose';
import { Application } from './schemas/application.schema';
import { Counter } from './schemas/counter.schema';

import * as crypto from 'crypto';
import * as fs from 'fs';


@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,

    @InjectModel(Counter.name)
    private readonly counterModel: Model<Counter>,
  ) {}

  private getFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}


private getPrimaryApplicant(app: any) {
  return app?.applicants?.[0] ?? null;
}

  /* ================= CREATE ================= */
 async create(body: any, userId: string , files: Express.Multer.File[] = []): Promise<Application> {
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
    const documentUrls: string[] = [];
    const uploadedHashes = new Set<string>();
    if (files.length) {
      const path = require('path');
      const baseDir = path.join('additional-info/docs-uploads', appId);
      fs.mkdirSync(baseDir, { recursive: true });
      for (const file of files) {
        // 🔐 Hash the uploaded file
        const fileHash = this.getFileHash(file.path);
        // 🚫 Block duplicate inside same request
        if (uploadedHashes.has(fileHash)) {
          fs.unlinkSync(file.path);
          throw new BadRequestException(
            `Duplicate file detected: ${file.originalname}`,
          );
        }
        uploadedHashes.add(fileHash);
        // 🚫 Block duplicate from DB (previous uploads)
        const duplicate = await this.applicationModel.findOne({
          userId,
          additionalInformationFileHashes: fileHash,
        });
        if (duplicate) {
          fs.unlinkSync(file.path);
          throw new BadRequestException(
            `This document was already uploaded for this application.`,
          );
        }
        const finalPath = path.join(baseDir, file.filename);
        fs.renameSync(file.path, finalPath);

        documentUrls.push(`/${finalPath.replace(/\\/g, '/')}`);
      }
    }
    //const applicant = body.applicant || {};
    const property = body.property || {};
    const loanRequirements = body.loanRequirements || {};
    const financialProfile = body.financialProfile || {};
    const solicitor = body.solicitor || {};
    const additionalInfo = body.additionalInfo || {};
    const applicants = Array.isArray(body.applicants)
  ? body.applicants.map(a => ({
      applyingAs: a.applyingAs ?? '',
      firstName: a.firstName ?? '',
      lastName: a.lastName ?? '',
      email: a.email ?? '',
      mobile: a.mobile ?? '',
      phoneNumber: a.phoneNumber ?? '',
      dateOfBirth: a.dateOfBirth ?? '',
      nationality: a.nationality ?? '',
      address: a.address ?? '',
      postcode: a.postcode ?? '',
      ownershipShare: a.ownershipShare ?? '',
      ownershipRole: a.ownershipRole ?? '',
      timeAtAddress: a.timeAtAddress ?? '',
      numberOfApplicants: a.numberOfApplicants ?? '1',
      previousAddress: {
        previousResidentialAddress:
          a.previousAddress?.previousResidentialAddress ?? '',
        previousPostcode:
          a.previousAddress?.previousPostcode ?? '',
      },
      companyAddress: a.companyAddress ?? '',
      companyRegistrationNumber: a.companyRegistrationNumber ?? '',
    }))
  : [];
    const application = new this.applicationModel({
      ...body, // keep as-is
      applicants, 
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
       additionalInformationDocuments: documentUrls,
      additionalInformationText: body.additionalInformationText ?? '',
      appId,
      userId,
      isDraft: true,
    });

    return await application.save();
  } 
  catch (error) {
  // ✅ HANDLE MONGOOSE VALIDATION ERRORS CLEANLY
  if (error?.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(
      (err: any) => err.message,
    );

    throw new BadRequestException({
      message: 'Validation failed',
      errors: messages,
    });
  }

  throw error;
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
  // async update(id: string, body: any, userId: string): Promise<Application> {
  //   const updated = await this.applicationModel.findOneAndUpdate(
  //     { _id: id, userId },
  //     {
  //       $set: {
  //         ...body,
  //         isDraft: false,

  //       },
  //     },
  //     { new: true },
  //   );

  //   if (!updated) {
  //     throw new ForbiddenException(
  //       'You are not authorized to update this application',
  //     );
  //   }
  //   return updated;
  // }



  // Update appliaction details frontend api application tabs
//   async updateApplicationDetails(
//   id: string,
//   body: any,
//   userId: string,
// ): Promise<Application> {

//   const updated = await this.applicationModel.findOneAndUpdate(
//     { _id: id, userId },
//     {
//       $set: {
//         ...body,
//         isDraft: false,
//       },
//     },
//     { new: true },
//   );

//   if (!updated) {
//     throw new ForbiddenException(
//       'You are not authorized to update this application',
//     );
//   }
//   return updated;
// }



async updateApplicationDetails(
  id: string,
  body: any,
  userId: string,
): Promise<Application> {
  try {
    // 🔹 STEP 1: Check DB first (application must exist)
    const existingApplication = await this.applicationModel.findOne({
      _id: id,
      userId,
    });

    if (!existingApplication) {
      throw new ForbiddenException(
        'You are not authorized to update this application',
      );
    }
    // 🔹 STEP 2: Resolve values (Body → DB fallback)
    const loanAmount = Number(
      body?.loanRequirements?.loanAmount ??
        body?.['loanRequirements.loanAmount'] ??
        existingApplication?.loanRequirements?.loanAmount
    );
    const propertyValue = Number(
      body?.property?.estimatedValue ??
        body?.['property.estimatedValue'] ??
        existingApplication?.property?.estimatedValue
    );

    // 🔴 STEP 3: If BOTH body + DB values are missing → BLOCK UPDATE
    if (isNaN(loanAmount) || isNaN(propertyValue) || propertyValue <= 0) {
      throw new BadRequestException(
        'Loan amount and property value are required to update application',
      );
    }

    // 🔹 STEP 4: LTV calculation
    let statusUpdate: any = {};
    const ltv = (loanAmount / propertyValue) * 100;


if (ltv > 75) {
  statusUpdate = {
    status: 'AUTO_REJECTED',
    rejectReason: 'LTV_EXCEEDED',
  };
} else if (body?.status === 'dip_stage') {
  statusUpdate = {
    status: 'dip_stage',
    application_stage_management: 'dip_approved',
    rejectReason:''
  };
}
    // 🔹 STEP 5: Sanitize body (DO NOT allow system fields)
    const safeBody = { ...body };

    delete safeBody.application_stage_management;
    delete safeBody.status;
    delete safeBody.rejectReason;
    delete safeBody.isDraft;
    delete safeBody.userId;
    delete safeBody.appId;

    // 🔹 STEP 6: ORIGINAL UPDATE (UNCHANGED STRUCTURE)
    const updated = await this.applicationModel.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          ...safeBody,
          isDraft: false,
          ...statusUpdate, // applied ONLY if LTV > 75
        },
      },
      { new: true },
    );

    // 🔴 Safety check (TS + runtime)
    if (!updated) {
      throw new ForbiddenException(
        'You are not authorized to update this application',
      );
    }

    return updated;
  } catch (error) {
    // 🔹 Known HTTP errors → rethrow
    if (
      error instanceof BadRequestException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    // 🔹 Unknown errors
    throw new InternalServerErrorException({
      message: 'Failed to update application',
      error: error?.message ?? 'Internal Server Error',
    });
  }
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
    { 'applicants.firstName': { $regex: raw, $options: 'i' } },
    { 'applicants.lastName': { $regex: raw, $options: 'i' } },
  ];

  // ✅ Full name search: "John11 Smith1111"
  if (parts.length >= 2) {
    filter.$or.push({
      $and: [
        {
          'applicants.firstName': {
            $regex: parts.slice(0, -1).join(' '),
            $options: 'i',
          },
        },
        {
          'applicants.lastName': {
            $regex: parts[parts.length - 1],
            $options: 'i',
          },
        },
      ],
    });
  }
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
  'applicants.firstName': 1,
  'applicants.lastName': 1,
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
  // applicant data is already inside item
  // const firstName = item?.applicant?.firstName ?? '';
  // const lastName = item?.applicant?.lastName ?? '';

 // const primaryApplicant = item?.applicants?.[0];

  // const firstName = primaryApplicant?.firstName ?? '';
  // const lastName = primaryApplicant?.lastName ?? '';

  // ✅ console if you want


    appId: item.appId,
  
  applicantName: `${item?.applicants?.[0]?.firstName ?? ''} ${item?.applicants?.[0]?.lastName ?? ''}`.trim(),



   // applicantName: `${applicant?.firstName ?? ''} ${applicant?.lastName ?? ''}`.trim(),
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
        'applicants.firstName': 1,
         'applicants.lastName': 1,
        'applicants.email': 1,   
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
        name: `${
          application?.applicants?.[0]?.firstName ?? ''
        } ${
          application?.applicants?.[0]?.lastName ?? ''
        }`.trim(),
        email: application?.applicants?.[0]?.email ?? '',
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
 // ================= SEARCH =================
if (search) {
  const raw = search.trim();
  const parts = raw.split(/\s+/);

  filter.$or = [
    { appId: { $regex: raw, $options: 'i' } },
    { 'property.address': { $regex: raw, $options: 'i' } },
    { 'applicants.firstName': { $regex: raw, $options: 'i' } },
    { 'applicants.lastName': { $regex: raw, $options: 'i' } },
  ];

  // ✅ Full name search (same applicant)
  if (parts.length >= 2) {
    filter.$or.push({
      applicants: {
        $elemMatch: {
          firstName: {
            $regex: parts.slice(0, -1).join(' '),
            $options: 'i',
          },
          lastName: {
            $regex: parts[parts.length - 1],
            $options: 'i',
          },
        },
      },
    });
  }
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
          'applicants.firstName': 1,
         'applicants.lastName': 1,
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
    //  applicantName: `${item.applicant?.firstName ?? ''} ${item.applicant?.lastName ?? ''}`.trim(),
      applicantName: `${item?.applicants?.[0]?.firstName ?? ''} ${item?.applicants?.[0]?.lastName ?? ''}`.trim(),

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
// ================= SEARCH =================
if (search) {
  const raw = search.trim();
  const parts = raw.split(/\s+/);

  const orConditions: any[] = [
    { appId: { $regex: raw, $options: 'i' } },
    { 'property.address': { $regex: raw, $options: 'i' } },
    { 'applicants.firstName': { $regex: raw, $options: 'i' } },
    { 'applicants.lastName': { $regex: raw, $options: 'i' } },
  ];

  // ✅ Full name search (same applicant)
  if (parts.length >= 2) {
    orConditions.push({
      applicants: {
        $elemMatch: {
          firstName: {
            $regex: parts.slice(0, -1).join(' '),
            $options: 'i',
          },
          lastName: {
            $regex: parts[parts.length - 1],
            $options: 'i',
          },
        },
      },
    });
  }

  // 🔹 Loan amount search (numeric)
  if (!isNaN(Number(raw))) {
    orConditions.push({
      'loanRequirements.loanAmount': Number(raw),
    });
  }

  filter.$or = orConditions;
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
          'applicants.firstName': 1,
'applicants.lastName': 1,

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
      applicantName: `${item?.applicants?.[0]?.firstName ?? ''} ${item?.applicants?.[0]?.lastName ?? ''}`.trim(),
     // applicantName: `${item.applicant?.firstName ?? ''} ${item.applicant?.lastName ?? ''}`.trim(),
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

  async deleteAdditionalDocument(
  applicationId: string,
  userId: string,
  fileUrl: string,
) {
  const fs = require('fs');
  const path = require('path');

  try {
    // ================= ID VALIDATION =================
    if (!Types.ObjectId.isValid(applicationId)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid application id',
      });
    }

    // ================= FIND APPLICATION =================
    const application = await this.applicationModel.findOne({
      _id: applicationId,
      userId,
    });

    if (!application) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Application not found',
      });
    }

    // ================= VALIDATE FILE =================
    if (!fileUrl || !application.additionalInformationDocuments.includes(fileUrl)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Document not found in this application',
      });
    }

    // ================= REMOVE FROM DATABASE =================
    await this.applicationModel.updateOne(
      { _id: applicationId },
      { $pull: { additionalInformationDocuments: fileUrl } },
    );

    // ================= REMOVE FROM FILE SYSTEM =================
    const absolutePath = path.join(process.cwd(), fileUrl);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    return {
      statusCode: 200,
      message: 'Document deleted successfully',
    };

  } catch (error) {

    // ================= HTTP EXCEPTIONS =================
    if (error?.status) {
      throw error;
    }

    // ================= MONGOOSE ID ERROR =================
    if (error?.name === 'CastError') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid application id',
      });
    }

    // ================= FALLBACK =================
    throw new InternalServerErrorException({
      statusCode: 500,
      message: 'Failed to delete document',
    });
  }
}

}
