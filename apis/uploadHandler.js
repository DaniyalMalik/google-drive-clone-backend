const express = require('express'),
  router = express.Router(),
  multer = require('multer'),
  path = require('path'),
  { auth } = require('../middleware/auth'),
  fs = require('fs'),
  User = require('../models/User'),
  util = require('util'),
  // mime = require('mime-types');
  mime = require('mime');

const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
      let user;

      if (!fs.existsSync(path.resolve('../google-drive-storage'))) {
        const mkdir = util.promisify(fs.mkdir);
        const promises = [];

        promises.push(mkdir(path.resolve('../google-drive-storage')));
        promises.push(User.findById(req.user));

        const result = await Promise.all(promises);

        user = result[1];
      } else {
        user = await User.findById(req.user);
      }

      if (user) {
        if (
          !fs.existsSync(
            path.join(
              path.resolve('../google-drive-storage'),
              `/${user.firstName}-${user.lastName}-${user._id}`,
            ),
          )
        ) {
          const mkdir = util.promisify(fs.mkdir);
          const promises = [];

          promises.push(
            mkdir(
              path.join(
                path.resolve('../google-drive-storage'),
                `/${user.firstName}-${user.lastName}-${user._id}`,
              ),
            ),
          );
          promises.push(
            User.findByIdAndUpdate(
              req.user,
              {
                folderPath: path.join(
                  path.resolve('../google-drive-storage'),
                  `/${user.firstName}-${user.lastName}-${user._id}`,
                ),
              },
              {
                new: true,
                runValidators: true,
                useFindAndModify: false,
              },
            ),
          );

          await Promise.all(promises);
        }

        cb(
          null,
          path.join(
            path.resolve('../google-drive-storage'),
            `/${user.firstName}-${user.lastName}-${user._id}`,
          ),
        );
      } else {
        return res
          .status(404)
          .json({ success: false, message: 'User not found!' });
      }
    },
    filename: function (req, file, cb) {
      cb(
        null,
        path.basename(file.originalname, path.extname(file.originalname)) +
          path.extname(file.originalname),
      );
    },
  }),
  upload = multer({ storage });

router.post('/', [auth, upload.array('files')], (req, res, next) => {
  try {
    if (!req.files)
      return res.status(422).json({
        success: false,
        message: 'You must select a file!',
      });

    res.status(200).json({
      success: true,
      message: 'Folder or File Uploaded Successfully!',
    });
  } catch (error) {
    console.log(error);

    next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user);
    const readdir = util.promisify(fs.readdir);
    const rawFiles = await readdir(user.folderPath);
    const files = [];
    let file;

    for (let i = 0; i < rawFiles.length; i++) {
      const readFile = util.promisify(fs.readFile);

      file = await readFile(path.join(user.folderPath, rawFiles[i]));

      files.push({
        file: file.toString('base64'),
        mimeType: mime.getType(
          path.basename(path.join(user.folderPath, rawFiles[i])),
        ),
        fileName: path.basename(
          path.join(user.folderPath, rawFiles[i]),
          path.extname(path.join(user.folderPath, rawFiles[i])),
        ),
        fileNameWithExt: path.basename(path.join(user.folderPath, rawFiles[i])),
      });
    }

    res.status(200).json({
      success: true,
      files,
    });
  } catch (error) {
    console.log(error);

    next(error);
  }
});

router.delete('/', auth, async (req, res, next) => {
  try {
    const { fileName } = req.query;
    const user = await User.findById(req.user);
    const unlink = util.promisify(fs.unlink);

    await unlink(path.join(user.folderPath, fileName));

    res.status(200).json({
      success: true,
      message: 'File deleted successfully!',
    });
  } catch (error) {
    console.log(error);

    next(error);
  }
});

module.exports = router;
