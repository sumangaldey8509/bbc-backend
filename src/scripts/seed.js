const mongoose = require('mongoose');
const config = require('../config');
const Role = require('../models/role.model');
const User = require('../models/user.model');
const Industry = require('../models/industry.model');
const State = require('../models/state.model');
const City = require('../models/city.model');
const logger = require('../utils/logger');

// Indian states & UTs, with a starter set of major cities per state.
const initialStates = [
  { name: 'Andhra Pradesh', code: 'AP', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'] },
  { name: 'Arunachal Pradesh', code: 'AR', cities: ['Itanagar', 'Naharlagun', 'Pasighat'] },
  { name: 'Assam', code: 'AS', cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia'] },
  { name: 'Bihar', code: 'BR', cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga'] },
  { name: 'Chhattisgarh', code: 'CG', cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg'] },
  { name: 'Goa', code: 'GA', cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'] },
  { name: 'Gujarat', code: 'GJ', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar'] },
  { name: 'Haryana', code: 'HR', cities: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar', 'Karnal', 'Rohtak'] },
  { name: 'Himachal Pradesh', code: 'HP', cities: ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu'] },
  { name: 'Jharkhand', code: 'JH', cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 'Hazaribagh'] },
  { name: 'Karnataka', code: 'KA', cities: ['Bengaluru', 'Mysuru', 'Hubli-Dharwad', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere'] },
  { name: 'Kerala', code: 'KL', cities: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur'] },
  { name: 'Madhya Pradesh', code: 'MP', cities: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'] },
  { name: 'Maharashtra', code: 'MH', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Kolhapur', 'Solapur'] },
  { name: 'Manipur', code: 'MN', cities: ['Imphal', 'Thoubal', 'Bishnupur'] },
  { name: 'Meghalaya', code: 'ML', cities: ['Shillong', 'Tura', 'Jowai'] },
  { name: 'Mizoram', code: 'MZ', cities: ['Aizawl', 'Lunglei', 'Champhai'] },
  { name: 'Nagaland', code: 'NL', cities: ['Kohima', 'Dimapur', 'Mokokchung'] },
  { name: 'Odisha', code: 'OD', cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur', 'Berhampur', 'Puri'] },
  { name: 'Punjab', code: 'PB', cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali'] },
  { name: 'Rajasthan', code: 'RJ', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Bhilwara'] },
  { name: 'Sikkim', code: 'SK', cities: ['Gangtok', 'Namchi', 'Gyalshing'] },
  { name: 'Tamil Nadu', code: 'TN', cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Tiruppur'] },
  { name: 'Telangana', code: 'TS', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'] },
  { name: 'Tripura', code: 'TR', cities: ['Agartala', 'Udaipur', 'Dharmanagar'] },
  { name: 'Uttar Pradesh', code: 'UP', cities: ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Noida', 'Bareilly', 'Aligarh'] },
  { name: 'Uttarakhand', code: 'UK', cities: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur'] },
  {
    name: 'West Bengal',
    code: 'WB',
    cities: [
      'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman',
      'Kharagpur', 'Haldia', 'Malda', 'Baharampur', 'Jalpaiguri', 'Darjeeling',
      'Kalyani', 'Krishnanagar', 'Bankura', 'Purulia', 'Cooch Behar', 'Raiganj',
      'Bidhannagar (Salt Lake)', 'Rajarhat',
    ],
  },
  // Union Territories
  { name: 'Andaman and Nicobar Islands', code: 'AN', type: 'ut', cities: ['Port Blair'] },
  { name: 'Chandigarh', code: 'CH', type: 'ut', cities: ['Chandigarh'] },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN', type: 'ut', cities: ['Silvassa', 'Daman', 'Diu'] },
  { name: 'Delhi', code: 'DL', type: 'ut', cities: ['New Delhi', 'Delhi'] },
  { name: 'Jammu and Kashmir', code: 'JK', type: 'ut', cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'] },
  { name: 'Ladakh', code: 'LA', type: 'ut', cities: ['Leh', 'Kargil'] },
  { name: 'Lakshadweep', code: 'LD', type: 'ut', cities: ['Kavaratti'] },
  { name: 'Puducherry', code: 'PY', type: 'ut', cities: ['Puducherry', 'Karaikal', 'Yanam', 'Mahe'] },
];

// Curated industry taxonomy for the autocomplete field.
const initialIndustries = [
  'Industrial Automation & Heavy Engineering',
  'Auto Components & Ancillaries',
  'Metals, Forgings & Castings',
  'Steel & Structural Fabrication',
  'Machine Tools & Capital Goods',
  'Electrical Equipment & Switchgear',
  'Plastics, Polymers & Packaging',
  'Cables & Wires',
  'Foundry & Metallurgy',
  'Tea, Plantation & Agro Exports',
  'Food Processing & Packaged Foods',
  'Edible Oils & Agri Commodities',
  'Aquaculture, Fisheries & Seafood',
  'Jute & Natural Fibre Products',
  'Cold Chain & Warehousing',
  'Textiles, Apparel & Garments',
  'Leather & Footwear',
  'Handicrafts & Home Décor',
  'Jewellery & Gems',
  'FMCG & Retail',
  'Healthcare & Hospitals',
  'Pharmaceuticals & Formulations',
  'Medical Devices & Diagnostics',
  'Biotechnology',
  'Real Estate & Construction',
  'Cement & Building Materials',
  'EPC & Project Contracting',
  'Roads, Railways & Urban Infrastructure',
  'Specialty & Industrial Chemicals',
  'Paints & Coatings',
  'Renewable Energy & Solar',
  'Oil, Gas & Petrochemicals',
  'Power Generation & Distribution',
  'Information Technology & Software',
  'IT-Enabled Services & BPM',
  'Logistics, Transport & Supply Chain',
  'Import–Export & Trading',
  'Banking, Financial Services & Insurance',
  'Professional & Consulting Services',
  'Hospitality, Travel & Tourism',
  'Media, Printing & Advertising',
  'Education & Skill Development',
  'Electronics & Electricals',
];

// Initial roles data
const initialRoles = [
  {
    name: 'admin',
    description: 'Administrator with full system access and management privileges',
    permissions: ['all'],
    isActive: true,
  },
  {
    name: 'member',
    description: 'Bengal Business Council Member with access to chapters and business desk',
    permissions: ['view_tables', 'book_tables', 'manage_profile'],
    isActive: true,
  },
  {
    name: 'user',
    description: 'Standard registered user',
    permissions: ['view_tables', 'manage_profile'],
    isActive: true,
  },
];

const bcrypt = require('bcryptjs');

// Initial users data
const initialUsers = [
  {
    firstName: 'System',
    lastName: 'Admin',
    email: 'admin@bengalbusinesscouncil.com',
    password: 'Admin@123',
    countryCode: '+91',
    phoneNumber: '9876543210',
    roleNames: ['admin'],
    isEmailVerified: true,
    isPhoneVerified: true,
    isActive: true,
  },
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@bengalbusinesscouncil.com',
    password: 'Member@123',
    countryCode: '+91',
    phoneNumber: '9876543211',
    roleNames: ['member'],
    isEmailVerified: true,
    isPhoneVerified: false,
    isActive: true,
  },
];

/**
 * Main seeding function
 */
const seedDatabase = async () => {
  try {
    logger.info('Starting database seeding...');

    if (!config.mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    // Connect to database
    await mongoose.connect(config.mongoUri);
    logger.info('Connected to MongoDB for seeding');

    // 1. Seed Roles
    logger.info('Seeding roles...');
    const roleMap = {};

    for (const roleData of initialRoles) {
      const role = await Role.findOneAndUpdate(
        { name: roleData.name },
        { $set: roleData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      roleMap[role.name] = role._id;
      logger.info(`✓ Role ready: ${role.name} (${role._id})`);
    }

    // 2. Seed Users
    logger.info('Seeding users...');
    for (const userData of initialUsers) {
      const { roleNames, password, ...userFields } = userData;
      const roleIds = (roleNames || []).map((name) => roleMap[name]).filter(Boolean);

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await User.findOneAndUpdate(
        { email: userFields.email },
        {
          $set: {
            ...userFields,
            password: hashedPassword,
            roles: roleIds,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate('roles');

      logger.info(`✓ User ready: ${user.firstName} ${user.lastName} <${user.email}> [${user.roles.map((r) => r.name).join(', ')}]`);
    }

    // 3. Seed Industry catalogue
    logger.info('Seeding industries...');
    for (const name of initialIndustries) {
      await Industry.findOneAndUpdate(
        { nameLower: name.toLowerCase() },
        { $set: { name, isCurated: true }, $setOnInsert: { usageCount: 0 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    logger.info(`✓ ${initialIndustries.length} curated industries ready`);

    // 4. Seed States & Cities
    logger.info('Seeding states & cities...');
    let cityCount = 0;
    for (const s of initialStates) {
      const state = await State.findOneAndUpdate(
        { nameLower: s.name.toLowerCase() },
        { $set: { name: s.name, code: s.code, type: s.type || 'state' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      for (const cityName of s.cities || []) {
        await City.findOneAndUpdate(
          { state: state._id, nameLower: cityName.toLowerCase() },
          { $set: { name: cityName, state: state._id, stateName: state.name, isCurated: true } },
          { upsert: true, setDefaultsOnInsert: true }
        );
        cityCount += 1;
      }
    }
    logger.info(`✓ ${initialStates.length} states/UTs and ${cityCount} cities ready`);

    logger.info('🎉 Database seeding completed successfully!');
  } catch (error) {
    logger.error(`❌ Seeding failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
    process.exit(process.exitCode || 0);
  }
};

// Execute if run directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
