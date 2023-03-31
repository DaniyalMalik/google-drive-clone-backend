const express = require('express'),
  router = express.Router(),
  multer = require('multer'),
  path = require('path'),
  getFolderSize = require('get-folder-size'),
  { auth } = require('../middleware/auth'),
  fs = require('fs'),
  User = require('../models/User'),
  util = require('util'),
  mime = require('mime');

function removeDot(folderName) {
  let temp = folderName.split(''),
    newName = '';

  for (let i = 0; i < temp.length; i++) {
    if (temp[i] === '.') {
      continue;
    }

    newName += temp[i];
  }

  return newName;
}

const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
      const { folderName, sameFolder } = req.query;
      // const folderSize = util.promisify(getFolderSize);
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

      // if (user) {
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

      // const size = await folderSize(
      //   path.join(
      //     path.resolve('../google-drive-storage'),
      //     `/${user.firstName}-${user.lastName}-${user._id}`,
      //   ),
      // );

      // if (size / 1024 / 1024 / 1024 < user.storageLimit) {
      if (folderName && (!sameFolder || sameFolder == 'false')) {
        // if (
        //   !fs.existsSync(
        //     path.join(
        //       path.resolve('../google-drive-storage'),
        //       `/${user.firstName}-${user.lastName}-${user._id}/${folderName}`,
        //     ),
        //   )
        // ) {
        let changedFolderName = folderName;

        if (folderName.includes('.')) {
          changedFolderName = removeDot(folderName);
        }

        mkdir(
          path.join(
            path.resolve('../google-drive-storage'),
            `/${user.firstName}-${user.lastName}-${user._id}/${changedFolderName}`,
          ),
        );

        cb(
          null,
          path.join(
            path.resolve('../google-drive-storage'),
            `/${user.firstName}-${user.lastName}-${user._id}/${changedFolderName}`,
          ),
        );
        // } else {
        //   cb(new Error('Folder already exists!'), false);
        // }
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
      // } else {
      //   cb('Your have reached your maximum storage limit!', false);
      // }
      // } else {
      //   cb('User does not exist!', false);
      // }
    },
    filename: function (req, file, cb) {
      cb(
        null,
        removeDot(
          path.basename(file.originalname, path.extname(file.originalname)),
        ) + path.extname(file.originalname),
      );
    },
  }),
  upload = multer({ storage }).array('files');

router.post('/', auth, async (req, res, next) => {
  try {
    const folderSize = util.promisify(getFolderSize);

    upload(req, res, async function (error) {
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

      let user = await User.findById(req.user);
      const size = await folderSize(
        path.join(
          path.resolve('../google-drive-storage'),
          `/${user.firstName}-${user.lastName}-${user._id}`,
        ),
      );

      user = await User.findByIdAndUpdate(
        req.user,
        { currentStorage: size / 1024 / 1024 / 1024 },
        { useFindAndModify: false },
      ).populate('shared');

      res.json({
        success: true,
        message: 'Uploaded Successfully!',
        user,
      });
    });
  } catch (error) {
    console.log(error, 'error');

    res.json({
      success: false,
      message: 'An error occurred!',
    });
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
  }
});

router.put('/rename', auth, async (req, res, next) => {
  try {
    const { oldPath, newPath } = req.body;
    const rename = util.promisify(fs.rename);
    console.log(oldPath, 'oldPath');
    console.log(newPath, 'newPath');

    if (fs.existsSync(newPath)) {
      return res.json({
        success: false,
        message: 'Name already exists!',
      });
    } else {
      await rename(oldPath, newPath);
    }

    res.json({
      success: true,
      message: 'Renamed successfully!',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.put('/share', auth, async (req, res, next) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email, _id: { $ne: req.user } });

    if (!user)
      return res.json({
        success: false,
        message: 'User not found!',
      });

    await User.updateOne(
      { _id: user._id },
      { $push: { sharedWithMe: req.user } },
    );
    await User.updateOne(
      { _id: req.user },
      { $push: { sharedWith: user._id } },
    );

    res.json({
      success: true,
      message: 'Shared successfully!',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.put('/unshare', auth, async (req, res, next) => {
  try {
    const { userId } = req.query;

    await User.updateOne(
      { _id: userId },
      {
        $pull: {
          sharedWithMe: req.user,
        },
      },
    );
    await User.updateOne(
      { _id: req.user },
      {
        $pull: {
          sharedWith: userId,
        },
      },
    );

    res.json({
      success: true,
      message: 'Unshared successfully!',
    });
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
    const { folderName, userPath } = req.query,
      folderSize = util.promisify(getFolderSize),
      user = await User.findById(req.user),
      readdir = util.promisify(fs.readdir),
      rawFiles = await readdir(
        folderName && userPath
          ? path.join(userPath, folderName)
          : folderName
          ? path.join(user.folderPath, folderName)
          : userPath
          ? userPath
          : user.folderPath,
      ),
      files = [],
      folders = [];
    let file;

    for (let i = 0; i < rawFiles.length; i++) {
      const readFile = util.promisify(fs.readFile);

      if (rawFiles[i].split('.').length === 2) {
        const { ...stats } = await fs.promises.stat(
          folderName && userPath
            ? path.join(userPath, folderName, rawFiles[i])
            : folderName
            ? path.join(user.folderPath, folderName, rawFiles[i])
            : userPath
            ? path.join(userPath, rawFiles[i])
            : path.join(user.folderPath, rawFiles[i]),
        );

        file = await readFile(
          folderName && userPath
            ? path.join(userPath, folderName, rawFiles[i])
            : folderName
            ? path.join(user.folderPath, folderName, rawFiles[i])
            : userPath
            ? path.join(userPath, rawFiles[i])
            : path.join(user.folderPath, rawFiles[i]),
        );
        files.push({
          file: file.toString('base64'),
          mimeType: mime.getType(
            path.basename(
              folderName && userPath
                ? path.join(userPath, folderName, rawFiles[i])
                : folderName
                ? path.join(user.folderPath, folderName, rawFiles[i])
                : userPath
                ? path.join(userPath, rawFiles[i])
                : path.join(user.folderPath, rawFiles[i]),
            ),
          ),
          fileName: path.basename(
            folderName && userPath
              ? path.join(userPath, folderName, rawFiles[i])
              : folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : userPath
              ? path.join(userPath, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
            path.extname(
              folderName && userPath
                ? path.join(userPath, folderName, rawFiles[i])
                : folderName
                ? path.join(user.folderPath, folderName, rawFiles[i])
                : userPath
                ? path.join(userPath, rawFiles[i])
                : path.join(user.folderPath, rawFiles[i]),
            ),
          ),
          fileNameWithExt: path.basename(
            folderName && userPath
              ? path.join(userPath, folderName, rawFiles[i])
              : folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : userPath
              ? path.join(userPath, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
          ),
          size: stats.size,
          location:
            folderName && userPath
              ? path.join(userPath, folderName, rawFiles[i])
              : folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : userPath
              ? path.join(userPath, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
        });
      } else {
        folders.push({
          size: await folderSize(
            folderName && userPath
              ? path.join(userPath, folderName, rawFiles[i])
              : folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : userPath
              ? path.join(userPath, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
          ),
          folderName: rawFiles[i],
          location:
            folderName && userPath
              ? path.join(userPath, folderName, rawFiles[i])
              : folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : userPath
              ? path.join(userPath, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
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
  }
});

router.delete('/', auth, async (req, res, next) => {
  try {
    const { fileOrFolderName, folder = false } = req.query,
      user = await User.findById(req.user);

    if (folder == 'false') {
      const folderSize = util.promisify(getFolderSize);
      const unlink = util.promisify(fs.unlink);
      const size = await folderSize(
        path.join(
          path.resolve('../google-drive-storage'),
          `/${user.firstName}-${user.lastName}-${user._id}`,
        ),
      );

      await unlink(path.join(user.folderPath, fileOrFolderName));
      await User.findByIdAndUpdate(
        req.user,
        { currentStorage: size / 1024 / 1024 / 1024 },
        { useFindAndModify: false },
      );

      res.json({
        success: true,
        message: 'File deleted successfully!',
      });
    } else {
      try {
        const unlink = util.promisify(fs.rmdir);
        const folderSize = util.promisify(getFolderSize);
        const size = await folderSize(
          path.join(
            path.resolve('../google-drive-storage'),
            `/${user.firstName}-${user.lastName}-${user._id}`,
          ),
        );

        await unlink(path.join(user.folderPath, fileOrFolderName), {
          recursive: true,
        });
        await User.findByIdAndUpdate(
          req.user,
          { currentStorage: size / 1024 / 1024 / 1024 },
          { useFindAndModify: false },
        );

        res.json({
          success: true,
          message: 'Folder deleted successfully!',
        });
      } catch (error) {
        console.log(error);

        res.json({
          success: false,
          message: 'Empty the folder first!',
        });
      }
    }
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
