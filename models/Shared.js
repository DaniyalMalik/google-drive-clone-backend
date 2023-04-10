const mongoose = require('mongoose'),
  { Schema } = mongoose,
  SharedSchema = new Schema(
    {
      sharedWith: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: [true, 'Shared with id is required!'],
      },
      sharedBy: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: [true, 'Shared by id is required!'],
      },
      sharedPath: {
        type: [String],
        required: [true, 'Shared path is required!'],
      },
    },
    {
      timestamps: true,
    },
  );

module.exports = mongoose.model('shared', SharedSchema);
