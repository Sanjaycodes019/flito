const mongoose = require('mongoose');

// A named running number, like the invoice sequence for one fiscal year
// ("invoice-2083-84"). Taken with nextSequence, which never hands the same
// number out twice.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.statics.nextSequence = async function nextSequence(key) {
  const counter = await this.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
