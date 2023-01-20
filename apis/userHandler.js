const express = require('express'),
  User = require('../models/User'),
  bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'),
  { auth } = require('../middleware/auth'),
  router = express.Router();

// register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { password, passwordCheck, firstName, email, lastName, phoneNumber } =
      req.body;

    if (
      !password ||
      !passwordCheck ||
      !firstName ||
      !email ||
      !lastName ||
      !phoneNumber
    )
      return res.json({
        success: false,
        message: "Enter all fields' values!",
      });

    if (password.length < 6) {
      return res.json({
        success: false,
        message: 'Password is too short!',
      });
    }

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
      phoneNumber,
      lastName,
      firstName,
    });
    const response = await newUser.save();

    res.json({
      message: 'User Registered!',
      success: true,
      user: response,
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

    const user = await User.findOne({ email }).select('-password');

    if (!user)
      return res.json({ success: false, message: 'User does not exist!' });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.json({ success: false, message: 'Invalid Credentials!' });

    const token = jwt.sign({ id: user._id }, process.env.secretKey);

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

router.post('/tokenIsValid', auth, async (req, res, next) => {
  try {
    const token = req.header('x-auth-token');

    if (!token) return res.json(false);

    const verified = jwt.verify(token, process.env.secretKey);

    if (!verified) return res.json(false);

    const user = await User.findById(verified.id);

    if (!user) return res.json(false);

    res.json(true);
  } catch (error) {
    console.log(error);

    next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user);

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

router.get('/users', auth, async (req, res, next) => {
  try {
    const users = await User.find();

    if (!users)
      return res.json({ success: false, message: 'No users were found!' });

    res.json({
      success: true,
      users,
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

    res.json({ success: false, message: 'User not found!' });

    next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);

    res.json({
      success: true,
      user,
      message: 'User deleted!',
    });
  } catch (error) {
    console.log(error);

    res.json({ success: false, message: 'An error occurred!' });

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
      message: 'User not found!',
    });
  }
});

router.put('/updatepassword/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params,
      updUser = req.body,
      oldUser = await User.findById(id).select('password'),
      isMatch = await bcrypt.compare(updUser.oldPassword, oldUser.password);

    if (!isMatch)
      return res.json({
        success: false,
        message: 'Old password is incorrect!',
      });

    if (updUser.password != updUser.passwordCheck)
      return res.json({ success: false, message: 'Passwords not matched' });

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(updUser.password, salt);
    const user = await User.findByIdAndUpdate(
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
        message: 'An error occurred!',
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

module.exports = router;
