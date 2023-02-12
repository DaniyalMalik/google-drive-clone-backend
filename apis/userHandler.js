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

    next(error);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) return res.json({ success: false, message: 'User not found!' });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.log(error);

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

    next(error);
  }
});

router.put('/updatepassword/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params,
      updUser = req.body,
      oldUser = await User.findById(id).select('+password'),
      isMatch = await bcrypt.compare(updUser.oldPassword, oldUser.password);

    if (!isMatch)
      return res.json({
        success: false,
        message: 'Old password is incorrect!',
      });

    if (updUser.password != updUser.passwordCheck)
      return res.json({ success: false, message: 'Passwords not matched!' });

    const salt = await bcrypt.genSalt(),
      passwordHash = await bcrypt.hash(updUser.password, salt),
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

    next(error);
  }
});

module.exports = router;
