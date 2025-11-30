const mongoose = require("mongoose");

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  // mongoose.connection.host can be undefined for SRV connections / replica sets.
  // Log a safe, informative message using what we can get reliably.
  const dbName = mongoose.connection?.name || "<unknown DB>";
  const state = mongoose.connection?.readyState ?? "?";

  try {
    // Attempt to extract a host string if present, but fall back gracefully.
    const host =
      mongoose.connection?.host ||
      (mongoose.connection?.client &&
        mongoose.connection.client.s &&
        mongoose.connection.client.s.url) ||
      "<host unavailable>";
    console.log(
      `Database connected — name:${dbName} host:${host} readyState:${state}`
    );
  } catch (err) {
    console.log(`Database connected — name:${dbName} readyState:${state}`);
  }
};

module.exports = connectDB;
