const mongoose = require('mongoose');
const Tournament = require('./models/Tournament');

const DEFAULT_DATA = {
  _id: 'main_tournament',
  config: {
    name: "Day F 2026",
    stage1Advance: 16,
    adminRoleIds: []
  },
  teams: {},
  stage1: { generated: false, matches: {}, rounds: [] },
  stage2: { generated: false, matches: {}, rounds: [] }
};

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  if (!process.env.MONGO_URI) {
    console.warn("⚠️ MONGO_URI is not set. Database operations will fail or timeout.");
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");
}

async function loadData() {
  await connectDB();
  let data = await Tournament.findById('main_tournament').lean();
  if (!data) {
    data = await Tournament.create(DEFAULT_DATA);
    data = data.toObject();
  }
  return data;
}

async function saveData(data) {
  await connectDB();
  await Tournament.findByIdAndUpdate('main_tournament', data, { upsert: true });
}

module.exports = { connectDB, loadData, saveData };
