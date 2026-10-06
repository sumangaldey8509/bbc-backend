const mongoose = require('mongoose');

const PROFILE_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected'];

const requirementDocSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    publicLink: { type: String, trim: true, required: true },
  },
  { _id: false }
);

const profileDetailsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Business identity
    designation: { type: String, trim: true, default: '' },
    companyName: { type: String, trim: true, default: '' },
    industry: { type: [String], default: [] },
    state: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },

    // Compliance
    gstNumber: { type: String, trim: true, default: '' },
    isGstVerified: { type: Boolean, default: false },
    /** Annual turnover: a number in `turnoverUnit` (k = thousand, l = lakh, cr = crore). */
    turnover: { type: Number, default: null, min: 0 },
    turnoverUnit: { type: String, enum: ['k', 'l', 'cr'], default: 'cr' },
    // NOTE: `yearJoined` is NOT stored — it is derived from the User's createdAt
    // year and injected into API responses by profile.service.

    // Media (Cloudinary secure URLs)
    avatar: { type: String, trim: true, default: '' },
    avatarUpdatedAt: { type: Date, default: null },
    coverImage: { type: String, trim: true, default: '' },
    coverImageUpdatedAt: { type: Date, default: null },

    // About
    bio: { type: String, trim: true, default: '' },
    requirementDocs: { type: [requirementDocSchema], default: [] },

    // Contact
    website: { type: String, trim: true, default: '' },
    officeAddress: { type: String, trim: true, default: '' },

    // Review workflow
    status: { type: String, enum: PROFILE_STATUSES, default: 'draft', index: true },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    collection: 'profile_details',
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
  }
);

const ProfileDetails = mongoose.model('ProfileDetails', profileDetailsSchema);

module.exports = ProfileDetails;
module.exports.PROFILE_STATUSES = PROFILE_STATUSES;
