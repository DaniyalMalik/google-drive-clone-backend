const express = require('express'),
  User = require('../models/User'),
  bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'),
  { auth } = require('../middleware/auth'),
  router = express.Router();

// register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { password, passwordCheck, firstName, email, lastName } = req.body;

    if (!password || !passwordCheck || !firstName || !email || !lastName)
      return res.json({
        success: false,
        message: "Enter all fields' values!",
      });
    ``;

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

    next(error);
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

    next(error);
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

    next(error);
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

    next(error);
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

    next(error);
  }
});

// Forgot password token
exports.forgotPassword = async (req, res, next) => {
  const response = new Response();
  const user = await User.findOne({ email: req.query.email });

  try {
    if (!user) {
      response.setError(`No user with the email: ${req.query.email} found!`);

      const { ...responseObj } = response;

      return res
        .status(StatusCode.getStatusCode(responseObj))
        .json(responseObj);
    }

    const resetToken = await user.getVerifyEmailToken();
    const resetUrl = `${resetToken}`;
    const message = `Enter the Following reset code in your mobile app: \n${resetUrl}`;

    // await sendEmail({
    //   email: user.email,
    //   subject: 'Verification Code',
    //   message,
    // });

    response.setSuccess(`Email to ${user.email} has been sent!`);

    const { ...responseObj } = response;

    res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
  } catch (error) {
    console.log(error);

    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;

    await user.save({ validateBeforeSave: false });

    response.setServerError(error);

    const { ...responseObj } = response;

    res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  const response = new Response();

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
      response.setError('Invalid Token!');

      const { ...responseObj } = response;

      return res
        .status(StatusCode.getStatusCode(responseObj))
        .json(responseObj);
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;

    await user.save();

    response.setSuccess('Password has been changed successfully!');

    const { ...responseObj } = response;

    res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
  } catch (error) {
    console.log(error);

    response.setServerError(error);

    const { ...responseObj } = response;

    res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
  }
};

// Verify email address
exports.verifyEmail = async (req, res, next) => {
  const response = new Response();

  try {
    const verifyEmailToken = crypto
      .createHash('sha256')
      .update(req.query.resetToken)
      .digest('hex');
    const user = await User.findOne({
      verifyEmailToken,
      verifyEmailTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      response.setError('Invalid Token!');

      const { ...responseObj } = response;

      return res
        .status(StatusCode.getStatusCode(responseObj))
        .json(responseObj);
    }

    user.isAccountVerified = true;
    user.verifyEmailToken = undefined;
    user.verifyEmailTokenExpiry = undefined;

    await user.save({ validateBeforeSave: false });

    response.setSuccess('Email Verified!');

    const { ...responseObj } = response;

    res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
  } catch (error) {
    console.log(error);

    response.setServerError(error);

    const { ...responseObj } = response;

    res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
  }
};

// Send verification email
exports.sendEmail = async (req, res, next) => {
  const response = new Response();

  try {
    const user = await User.findOne({ email: req.query.email });

    if (!user) {
      response.setError('User does not exist!');

      const { ...responseObj } = response;

      res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
    }

    const resetToken = await user.getVerifyEmailToken();
    const resetUrl = `${resetToken}`;
    const message = `Enter the Following reset code in your mobile app: \n${resetUrl}`;

    // await sendEmail({
    //   email: user.email,
    //   subject: 'Verification Code',
    //   message,
    // });

    response.setSuccess('Verification email was sent successfully!');

    const { ...responseObj } = response;

    res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
  } catch (error) {
    console.log(error);

    response.setServerError(error);

    const { ...responseObj } = response;

    res.status(StatusCode.getStatusCode(responseObj)).json(responseObj);
  }
};

module.exports = router;
