const express = require('express'),
  User = require('../models/User'),
  bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'),
  sendEmail = require('../config/sendEmail'),
  crypto = require('crypto'),
  { auth } = require('../middleware/auth'),
  router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { password, passwordCheck, firstName, email, lastName } = req.body;

    if (!password || !passwordCheck || !firstName || !email || !lastName)
      return res.json({
        success: false,
        message: "Enter all fields' values!",
      });

    if (password != passwordCheck)
      return res.json({ success: false, message: 'Passwords do not match!' });

    const existingUser = await User.findOne({ email });

    if (existingUser)
      return res.json({
        success: false,
        message: 'Email ID already exist!',
      });

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = new User({
      password: passwordHash,
      email,
      lastName,
      firstName,
    });

    await newUser.save();

    const resetToken = await newUser.getVerifyEmailToken();
    const resetUrl = `http://localhost:3000/login/${resetToken}`;
    const message = `Click on the following url to verify your email address: \n${resetUrl}`;

    await sendEmail({
      email: newUser.email,
      subject: 'Verification Code',
      message,
    });

    res.json({
      message: 'User Registered!',
      success: true,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.json({
        success: false,
        message: 'Enter all fields!',
      });

    const user = await User.findOne({ email }).select('+password');

    if (!user)
      return res.json({ success: false, message: 'User does not exist!' });

    if (!user.isEmailVerified)
      return res.json({
        success: false,
        isEmailVerified: false,
        message: 'Verify your email address first!',
      });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.json({ success: false, message: 'Invalid Credentials!' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({
      success: true,
      message: 'Logged In!',
      user,
      token,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'User deleted!',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.put('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params,
      updUser = req.body,
      user = await User.findByIdAndUpdate(id, updUser, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
      });

    if (!user) {
      return res.json({
        success: false,
        message: 'User not found!',
      });
    }

    res.json({ success: true, message: 'User Updated!', user });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.put('/updatepassword/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params,
      updUser = req.body,
      oldUser = await User.findById(id).select('password'),
      matchPassword = await oldUser.matchPassword(updUser.oldPassword);

    if (!matchPassword)
      return res.json({
        success: false,
        message: 'Old password is incorrect!',
      });

    const salt = await bcrypt.genSalt(),
      passwordHash = await bcrypt.hash(updUser.newPassword, salt),
      user = await User.findByIdAndUpdate(
        id,
        { password: passwordHash },
        {
          new: true,
          runValidators: true,
          useFindAndModify: false,
        },
      );

    if (!user) {
      return res.json({
        success: false,
        message: 'Password could not be updated!',
      });
    }

    res.json({ success: true, message: 'Password Updated!', user });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user);

    if (!user) {
      return res.json({
        success: false,
        message: 'User not found!',
      });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.get('/all', auth, async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.user } });

    if (!users) {
      return res.json({
        success: false,
        message: 'User not found!',
      });
    }

    res.json({ success: true, users });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.post('/forgotpassword', async (req, res, next) => {
  const user = await User.findOne({ email: req.query.email });

  try {
    if (!user) {
      return res.json({
        success: false,
        message: `No user with the email: ${req.query.email} found!`,
      });
    }

    const resetToken = await user.getResetPasswordToken();
    const resetUrl = `http://localhost:3000/resetpassword/${resetToken}`;
    const message = `Click on this url: \n${resetUrl}`;

    await sendEmail({
      email: user.email,
      subject: 'Verification URL',
      message,
    });

    res.json({
      success: true,
      message: `Email to ${user.email} has been sent!`,
    });
  } catch (error) {
    console.log(error);

    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;

    await user.save({ validateBeforeSave: false });

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.post('/resetpassword', async (req, res, next) => {
  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.body.resetToken)
      .digest('hex');
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.json({
        success: false,
        message: 'Invalid Token!',
      });
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(req.body.password, salt);

    user.password = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;

    await user.save();

    res.json({
      success: true,
      message: 'Password has been changed successfully!',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.post('/verifyemail', async (req, res, next) => {
  try {
    const verifyEmailToken = crypto
      .createHash('sha256')
      .update(req.body.resetToken)
      .digest('hex');
    const user = await User.findOne({
      verifyEmailToken,
      verifyEmailTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.json({
        success: false,
        message: 'Invalid Token!',
      });
    }

    user.isEmailVerified = true;
    user.verifyEmailToken = undefined;
    user.verifyEmailTokenExpiry = undefined;

    await user.save({ validateBeforeSave: false });

    res.json({
      user,
      success: true,
      message: 'Email Verified!',
    });
  } catch (error) {
    console.log(error);

    return res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.get('/sendverifyemail', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.query.email });

    if (!user)
      return res.json({
        success: false,
        message: 'User does not exist!',
      });

    const resetToken = await user.getVerifyEmailToken();
    const resetUrl = `http://localhost:3000/login/${resetToken}`;
    const message = `Click on the following url to verify your email address: \n${resetUrl}`;

    await sendEmail({
      email: user.email,
      subject: 'Verification Code',
      message,
    });

    res.json({
      success: true,
      message: 'Verification email was sent successfully!',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.json({
        success: false,
        message: 'User not found!',
      });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

module.exports = router;
