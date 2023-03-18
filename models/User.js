const mongoose = require('mongoose'),
  bcrypt = require('bcryptjs'),
  { Schema } = mongoose,
  crypto = require('crypto'),
  UserSchema = new Schema(
    {
      email: {
        type: String,
        required: [true, 'Email is required!'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
          'Please enter a valid email address',
        ],
      },
      firstName: {
        type: String,
        required: [true, 'First name is required!'],
      },
      isEmailVerified: {
        type: Boolean,
        default: false,
      },
      lastName: {
        type: String,
        required: [true, 'Last name is required!'],
      },
      folderPath: String,
      password: {
        type: String,
        required: [true, 'Password is required!'],
        minlength: 6,
        select: false,
      },
      storageLimit: {
        type: Number,
        default: 5,
      },
      currentStorage: {
        type: Number,
        default: 0,
      },
      verifyEmailToken: String,
      resetPasswordToken: String,
      verifyEmailTokenExpiry: Date,
      resetPasswordTokenExpiry: Date,
    },
    {
      timestamps: true,
    },
  );

// Comparing passwords
UserSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordTokenExpiry = Date.now() + 10 * 60 * 1000;
  this.save({ validateBeforeSave: false });

  return resetToken;
};

UserSchema.methods.getVerifyEmailToken = function () {
  const resetToken = crypto.randomBytes(6).toString('hex');

  this.verifyEmailToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.verifyEmailTokenExpiry = Date.now() + 10 * 60 * 1000;
  this.save({ validateBeforeSave: false });

  return resetToken;
};

module.exports = mongoose.model('user', UserSchema);
