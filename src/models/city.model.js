const mongoose = require('mongoose');

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, lowercase: true, trim: true },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true, index: true },
    /** Denormalised for quick display / storage on the profile. */
    stateName: { type: String, required: true, trim: true },
    usageCount: { type: Number, default: 0, min: 0 },
    isCurated: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
  }
);

// A city name is unique within a state (but "Hyderabad" can exist in two states).
citySchema.index({ state: 1, nameLower: 1 }, { unique: true });

module.exports = mongoose.model('City', citySchema);
