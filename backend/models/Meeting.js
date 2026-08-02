import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  avatar: { type: String },
}, { _id: true });

const meetingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['instant', 'scheduled'], default: 'scheduled' },
    title: { type: String, required: true, default: 'Meeting' },
    roomName: { type: String, required: true, unique: true },
    link: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    timezone: { type: String, default: 'Asia/Kolkata' },
    description: { type: String },
    participants: [participantSchema],
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    duration: { type: Number }, // in minutes
    notification: {
      amount: { type: Number, default: 30 },
      unit: {
        type: String,
        enum: ['minutes before', 'hours before', 'days before', 'weeks before'],
        default: 'minutes before',
      },
      type: {
        type: String,
        enum: ['As Notification', 'As Email'],
        default: 'As Notification',
      },
    },
    reminderSent: { type: Boolean, default: false },
    hostJoined: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    isConsultation: { type: Boolean, default: false },
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for efficient reminder queries
meetingSchema.index({ status: 1, reminderSent: 1, startTime: 1 });
// Index for fast participant dashboard lookup
meetingSchema.index({ 'participants.email': 1 });
// Index for sorting and filtering upcoming/past meetings
meetingSchema.index({ startTime: 1, endTime: 1 });

export default mongoose.model('Meeting', meetingSchema);
