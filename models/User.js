const mongoose = require('mongoose'),
  { Schema } = mongoose,
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
      lastName: {
        type: String,
        required: [true, 'Last name is required!'],
      },
      phoneNumber: {
        required: [true, 'Phone Number is required!'],
        type: String,
      },
      password: {
        type: String,
        required: [true, 'Password is required!'],
        minlength: 6,
        select: false,
      },
    },
    {
      timestamps: true,
    },
  );

// Comparing passwords
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('user', UserSchema);
