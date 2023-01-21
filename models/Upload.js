const mongoose = require('mongoose'),
  { Schema } = mongoose,
  UploadsSchema = new Schema(
    {
      path: {
        type: String,
        required: [true, 'File path is required!'],
      },
      userId: {
        type: String,
        required: [true, 'User id is required!'],
      },
    },
    {
      timestamps: true,
    },
  );

module.exports = mongoose.model('uploads', UploadsSchema);
