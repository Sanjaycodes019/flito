const mongoose = require('mongoose');

// Every change an admin makes: who did what to which record, and why. Records
// are only ever added, never edited, so the history of a user, truck, booking
// or load can be read back on its admin page. See services/audit.js.
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // e.g. "user.suspended", "kyc.approved", "truck.revoked", "booking.cancelled"
    action: { type: String, required: true },
    targetType: { type: String, enum: ['user', 'truck', 'booking', 'load', 'platform'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // What the admin wrote for the person affected, when there is one.
    reason: String,
    // Small facts about the change, e.g. { from: 'active', to: 'suspended' }.
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A record's history, newest first; and everything one admin did.
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
