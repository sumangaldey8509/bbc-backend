const mongoose = require('mongoose');

const industrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Case-insensitive dedup key.
    nameLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // How many member profiles currently list this industry — used to rank suggestions.
    usageCount: { type: Number, default: 0, min: 0 },
    // Seeded taxonomy entries surface above ad-hoc ones.
    isCurated: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
  }
);

const Industry = mongoose.model('Industry', industrySchema);

module.exports = Industry;
