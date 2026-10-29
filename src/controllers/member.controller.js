const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { isVerified } = require('../utils/verify');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { logActivity } = require('../utils/activity');
const User = require('../models/user.model');
const Role = require('../models/role.model');

const VERIFY_FIELDS = ['aadhaar', 'pan', 'gst', 'whatsapp', 'altPhone', 'personalMail', 'officialMail'];

const getMembers = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const members = await db.collection('members').find().sort({ createdAt: -1 }).toArray();
    return sendSuccess(res, members);
  } catch (error) {
    return sendError(res, error.message || 'Failed to list members.', 500, error);
  }
};

const createMember = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const b = req.body || {};

    if (!b.name || !b.whatsapp) {
      return sendError(res, 'Member Name and WhatsApp number are required.', 400);
    }

    // Verify KYC / OTP flags
    for (const k of VERIFY_FIELDS) {
      if (b[k] && !(await isVerified(k, b[k]))) {
        return sendError(res, `Field "${k}" has not been verified. Please complete verification.`, 400);
      }
    }

    // Mask Aadhaar: never store full Aadhaar number
    if (b.aadhaar) {
      b.aadhaar = 'XXXXXXXX' + String(b.aadhaar).slice(-4);
    }

    const tempPassword = crypto.randomBytes(5).toString('hex');
    const email = (b.officialMail || b.personalMail || `${String(b.whatsapp).replace(/\D/g, '')}@bbc.local`).toLowerCase();

    // Ensure member role exists
    let memberRole = await Role.findOne({ name: 'member' });
    if (!memberRole) {
      memberRole = await Role.create({ name: 'member', description: 'Council member', modules: ['feed', 'profile'] });
    }

    // Split name into first and last
    const parts = String(b.name || '').trim().split(' ');
    const firstName = parts[0] || 'Member';
    const lastName = parts.slice(1).join(' ') || '.';

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          phoneNumber: String(b.whatsapp).replace(/\D/g, ''),
          roles: [memberRole._id],
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const memberDoc = {
      ...b,
      role: 'member',
      userId: String(user._id),
      createdAt: new Date(),
    };

    await db.collection('members').insertOne(memberDoc);
    await logActivity(req.user, 'member.create', { name: b.name, userId: String(user._id) });

    return sendSuccess(
      res,
      {
        member: memberDoc,
        login: email,
        tempPassword,
      },
      'Member enrolled successfully.',
      201
    );
  } catch (error) {
    return sendError(res, error.message || 'Failed to create member.', 500, error);
  }
};

module.exports = {
  getMembers,
  createMember,
};
