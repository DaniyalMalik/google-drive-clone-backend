const express = require('express'),
  router = express.Router(),
  multer = require('multer'),
  path = require('path'),
  { auth } = require('../middleware/auth'),
  fs = require('fs'),
  User = require('../models/User'),
  util = require('util'),
  mime = require('mime');

const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
      const { folderName, sameFolder } = req.query;
      const mkdir = util.promisify(fs.mkdir);
      let user;

      if (!fs.existsSync(path.resolve('../google-drive-storage'))) {
        const promises = [];

        promises.push(mkdir(path.resolve('../google-drive-storage')));
        promises.push(User.findById(req.user));

        const result = await Promise.all(promises);

        user = result[1];
      } else {
        user = await User.findById(req.user);
      }
      console.log(
        folderName,
        sameFolder,
        user,
        'folderName, sameFolder, user!!!!!!!',
      );
      if (user) {
        if (
          !fs.existsSync(
            path.join(
              path.resolve('../google-drive-storage'),
              `/${user.firstName}-${user.lastName}-${user._id}`,
            ),
          )
        ) {
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

        if (folderName && (!sameFolder || sameFolder == 'false')) {
          if (
            !fs.existsSync(
              path.join(
                path.resolve('../google-drive-storage'),
                `/${user.firstName}-${user.lastName}-${user._id}/${folderName}`,
              ),
            )
          ) {
            mkdir(
              path.join(
                path.resolve('../google-drive-storage'),
                `/${user.firstName}-${user.lastName}-${user._id}/${folderName}`,
              ),
            );

            cb(
              null,
              path.join(
                path.resolve('../google-drive-storage'),
                `/${user.firstName}-${user.lastName}-${user._id}/${folderName}`,
              ),
            );
          } else {
            cb(new Error('Folder already exists!'), false);
          }
        } else if (folderName && sameFolder == 'true') {
          cb(
            null,
            path.join(
              path.resolve('../google-drive-storage'),
              `/${user.firstName}-${user.lastName}-${user._id}/${folderName}`,
            ),
          );
        } else {
          cb(
            null,
            path.join(
              path.resolve('../google-drive-storage'),
              `/${user.firstName}-${user.lastName}-${user._id}`,
            ),
          );
        }
      } else {
        return cb(new Error('User does not exist!'), false);
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
  upload = multer({ storage }).array('files');

router.post('/', auth, (req, res, next) => {
  try {
    upload(req, res, (error) => {
      if (!req.files)
        return res.json({
          success: false,
          message: 'You must select a file!',
        });

      if (error)
        return res.json({
          success: false,
          message: error.message,
        });
      console.log(req.files, 'req.files');
      res.json({
        success: true,
        message: 'Uploaded Successfully!',
      });
    });
  } catch (error) {
    console.log(error, 'error');

    res.json({
      success: false,
      message: 'An error occurred!',
    });

    next(error);
  }
});

router.post('/create', auth, async (req, res, next) => {
  try {
    const { folderName } = req.body,
      mkdir = util.promisify(fs.mkdir),
      user = await User.findById(req.user);

    if (!fs.existsSync(path.resolve(path.join(user.folderPath, folderName)))) {
      await mkdir(path.resolve(path.join(user.folderPath, folderName)));

      res.json({
        success: true,
        message: 'Folder Created Successfully!',
      });
    } else {
      res.json({
        success: false,
        message: 'Folder already exists!',
      });
    }
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });

    next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const { folderName } = req.query,
      user = await User.findById(req.user),
      readdir = util.promisify(fs.readdir),
      rawFiles = await readdir(
        folderName ? path.join(user.folderPath, folderName) : user.folderPath,
      ),
      files = [],
      folders = [];
    let file;

    for (let i = 0; i < rawFiles.length; i++) {
      const readFile = util.promisify(fs.readFile);

      if (rawFiles[i].split('.').length === 2) {
        file = await readFile(
          folderName
            ? path.join(user.folderPath, folderName, rawFiles[i])
            : path.join(user.folderPath, rawFiles[i]),
        );

        files.push({
          file: file.toString('base64'),
          mimeType: mime.getType(
            path.basename(
              folderName
                ? path.join(user.folderPath, folderName, rawFiles[i])
                : path.join(user.folderPath, rawFiles[i]),
            ),
          ),
          fileName: path.basename(
            folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
            path.extname(
              folderName
                ? path.join(user.folderPath, folderName, rawFiles[i])
                : path.join(user.folderPath, rawFiles[i]),
            ),
          ),
          fileNameWithExt: path.basename(
            folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
          ),
        });
      } else {
        folders.push({
          folderName: rawFiles[i],
        });
      }
    }

    res.json({
      success: true,
      files,
      folders,
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

router.delete('/', auth, async (req, res, next) => {
  try {
    const { fileOrFolderName } = req.query;
    const user = await User.findById(req.user);
    const unlink = util.promisify(fs.unlink);

    await unlink(path.join(user.folderPath, fileOrFolderName));

    res.json({
      success: true,
      message: 'File deleted successfully!',
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

module.exports = router;
