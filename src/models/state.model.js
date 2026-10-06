const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    /** ISO 3166-2 style code, e.g. "WB". */
    code: { type: String, trim: true, uppercase: true, default: '' },
    /** Union Territory vs State. */
    type: { type: String, enum: ['state', 'ut'], default: 'state' },
  },
  {
    timestamps: true,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
  }
);

module.exports = mongoose.model('State', stateSchema);
