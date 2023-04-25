const Shared = require('../models/Shared');

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

        if (folderName.includes('.')) changedFolderName = removeDot(folderName);

        if (
          !fs.existsSync(
            path.join(
              path.resolve('../google-drive-storage'),
              `/${user.firstName}-${user.lastName}-${user._id}/${changedFolderName}`,
            ),
          )
        )
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
      );

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

    if (!fs.existsSync(path.join(user.folderPath, folderName))) {
      await mkdir(path.join(user.folderPath, folderName));

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
    const payload = req.body;
    const user = await User.findById(req.user);
    let shared = await Shared.findOne({
      sharedWith: payload.userId,
      sharedBy: user._id,
    });

    if (shared && payload.wholeFolder) {
      shared.sharedPath = [user.folderPath];

      await shared.save();
    } else if (shared) {
      if (
        !shared.sharedPath.includes(payload.path) &&
        !shared.sharedPath.includes(user.folderPath)
      ) {
        shared.sharedPath = shared.sharedPath.concat(payload.path);

        await shared.save();
      }
    } else if (!shared && payload.wholeFolder) {
      shared = await Shared.create({
        ...payload,
        sharedPath: [user.folderPath],
        sharedBy: req.user,
        sharedWith: payload.userId,
      });
    } else {
      shared = await Shared.create({
        ...payload,
        sharedPath: [payload.path],
        sharedBy: req.user,
        sharedWith: payload.userId,
      });
    }

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
    const { wholeFolder = undefined, userId, path } = req.body;

    if (wholeFolder) {
      await Shared.deleteOne({
        sharedWith: userId,
        sharedBy: req.user,
      });
    } else {
      await Shared.updateOne(
        { sharedBy: req.user, sharedWith: userId },
        {
          $pull: {
            sharedPath: path,
          },
        },
      );
    }

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
    const { folderName, userPath, customPath, userId = undefined } = req.query,
      folderSize = util.promisify(getFolderSize),
      user = await User.findById(userId ? userId : req.user),
      readdir = util.promisify(fs.readdir),
      rawFiles = await readdir(
        folderName && userPath
          ? path.join(userPath, folderName)
          : folderName
          ? path.join(user.folderPath, folderName)
          : userPath
          ? userPath
          : customPath
          ? customPath
          : user.folderPath,
      ),
      files = [],
      folders = [];
    let file;

    for (let i = 0; i < rawFiles.length; i++) {
      const readFile = util.promisify(fs.readFile);
      const { ...stats } = await fs.promises.stat(
        folderName && userPath
          ? path.join(userPath, folderName, rawFiles[i])
          : folderName
          ? path.join(user.folderPath, folderName, rawFiles[i])
          : userPath
          ? path.join(userPath, rawFiles[i])
          : customPath
          ? path.join(customPath, rawFiles[i])
          : path.join(user.folderPath, rawFiles[i]),
      );

      if (rawFiles[i].split('.').length === 2) {
        file = await readFile(
          folderName && userPath
            ? path.join(userPath, folderName, rawFiles[i])
            : folderName
            ? path.join(user.folderPath, folderName, rawFiles[i])
            : userPath
            ? path.join(userPath, rawFiles[i])
            : customPath
            ? path.join(customPath, rawFiles[i])
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
                : customPath
                ? path.join(customPath, rawFiles[i])
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
              : customPath
              ? path.join(customPath, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
            path.extname(
              folderName && userPath
                ? path.join(userPath, folderName, rawFiles[i])
                : folderName
                ? path.join(user.folderPath, folderName, rawFiles[i])
                : userPath
                ? path.join(userPath, rawFiles[i])
                : customPath
                ? path.join(customPath, rawFiles[i])
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
              : customPath
              ? path.join(customPath, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
          ),
          size: stats.size,
          createdAt: new Date(stats.mtime).toLocaleString(),
          location:
            folderName && userPath
              ? path.join(userPath, folderName, rawFiles[i])
              : folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : userPath
              ? path.join(userPath, rawFiles[i])
              : customPath
              ? path.join(customPath, rawFiles[i])
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
              : customPath
              ? path.join(customPath, rawFiles[i])
              : path.join(user.folderPath, rawFiles[i]),
          ),
          createdAt: new Date(stats.mtime).toLocaleString(),
          folderName: rawFiles[i],
          location:
            folderName && userPath
              ? path.join(userPath, folderName, rawFiles[i])
              : folderName
              ? path.join(user.folderPath, folderName, rawFiles[i])
              : userPath
              ? path.join(userPath, rawFiles[i])
              : customPath
              ? path.join(customPath, rawFiles[i])
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

router.post('/shared', auth, async (req, res, next) => {
  try {
    const { paths } = req.body,
      folderSize = util.promisify(getFolderSize),
      // readdir = util.promisify(fs.readdir),
      files = [],
      folders = [];
    let file, rawFiles;

    for (let i = 0; i < paths.length; i++) {
      file = undefined;
      rawFiles = undefined;

      if (
        paths[i].split('\\')[paths[i].split('\\').length - 1].split('.')
          .length === 2
      ) {
        rawFiles = [paths[i]];

        for (let i = 0; i < rawFiles.length; i++) {
          const readFile = util.promisify(fs.readFile);
          const { ...stats } = await fs.promises.stat(rawFiles[i]);

          file = await readFile(rawFiles[i]);
          files.push({
            file: file.toString('base64'),
            mimeType: mime.getType(path.basename(rawFiles[i])),
            fileName: path.basename(rawFiles[i], path.extname(rawFiles[i])),
            fileNameWithExt: path.basename(rawFiles[i]),
            size: stats.size,
            location: rawFiles[i],
          });
        }
      } else {
        rawFiles = paths[i];
        // rawFiles = await readdir(paths[i]);

        // for (let j = 0; j < rawFiles.length; j++) {
        //   const readFile = util.promisify(fs.readFile);
        //   console.log(paths[i], 'paths[i]');
        //   console.log(rawFiles[j], 'rawFiles[j]');
        //   if (rawFiles[j].split('.').length === 2) {
        //     const { ...stats } = await fs.promises.stat(
        //       path.join(paths[i], rawFiles[j]),
        //     );

        //     file = await readFile(path.join(paths[i], rawFiles[j]));
        //     files.push({
        //       file: file.toString('base64'),
        //       mimeType: mime.getType(
        //         path.basename(path.join(paths[i], rawFiles[j])),
        //       ),
        //       fileName: path.basename(
        //         path.join(paths[i], rawFiles[j]),
        //         path.extname(path.join(paths[i], rawFiles[j])),
        //       ),
        //       fileNameWithExt: path.basename(path.join(paths[i], rawFiles[j])),
        //       size: stats.size,
        //       location: path.join(paths[i], rawFiles[j]),
        //     });
        //   } else {
        folders.push({
          size: await folderSize(rawFiles),
          folderName: rawFiles.split('\\')[rawFiles.split('\\').length - 1],
          location: rawFiles,
        });
        //     }
        //   }
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

router.post('/delete', auth, async (req, res, next) => {
  try {
    const { folder = false, customPath = undefined } = req.body;

    console.log(customPath, 'customPath');
    console.log(folder, 'folder');
    if (folder == 'false') {
      console.log('here-1');
      const unlink = util.promisify(fs.unlink);

      await unlink(customPath);

      res.json({
        success: true,
        message: 'File deleted successfully!',
      });
    } else {
      try {
        console.log('here-2');
        const unlink = util.promisify(fs.rm);

        await unlink(customPath, {
          recursive: true,
        });

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
      message: 'An error occurred!',
    });
  }
});

router.get('/sharedwith', auth, async (req, res, next) => {
  try {
    const shared = await Shared.find({ sharedWith: req.user }).populate(
      'sharedBy sharedWith',
    );

    res.json({
      success: true,
      shared,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.get('/sharedby', auth, async (req, res, next) => {
  try {
    const shared = await Shared.find({ sharedBy: req.user }).populate(
      'sharedBy sharedWith',
    );

    res.json({
      success: true,
      shared,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.post('/trash', auth, async (req, res, next) => {
  try {
    const { oldPath, newPath } = req.body;
    const rename = util.promisify(fs.rename);
    const folderSize = util.promisify(getFolderSize);
    const user = await User.findById(req.user);
    let userFolderTemp = user.folderPath.split('\\');
    let trashTemp = user.folderPath.split('\\');
    const mkdir = util.promisify(fs.mkdir);

    trashTemp.pop();
    trashTemp.splice(trashTemp.length, 0, 'trash');
    userFolderTemp.splice(userFolderTemp.length - 1, 0, 'trash');

    const userFolderDir = userFolderTemp.join('\\');
    const trashDir = trashTemp.join('\\');

    if (!fs.existsSync(trashDir)) {
      await mkdir(trashDir);
      await mkdir(userFolderDir);
    } else if (!fs.existsSync(userFolderDir)) {
      await mkdir(userFolderDir);
    }

    await rename(oldPath, newPath);

    const size = await folderSize(
      path.join(
        path.resolve('../google-drive-storage'),
        `/${user.firstName}-${user.lastName}-${user._id}`,
      ),
    );
    await User.findByIdAndUpdate(
      req.user,
      { currentStorage: size / 1024 / 1024 / 1024 },
      { useFindAndModify: false },
    );

    res.json({
      success: true,
      message: 'Moved to trash!',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.post('/recover', auth, async (req, res, next) => {
  try {
    const { oldPath, newPath } = req.body;
    const rename = util.promisify(fs.rename);
    const folderSize = util.promisify(getFolderSize);
    const user = await User.findById(req.user);

    await rename(oldPath, newPath);

    const size = await folderSize(
      path.join(
        path.resolve('../google-drive-storage'),
        `/${user.firstName}-${user.lastName}-${user._id}`,
      ),
    );
    await User.findByIdAndUpdate(
      req.user,
      { currentStorage: size / 1024 / 1024 / 1024 },
      { useFindAndModify: false },
    );

    res.json({
      success: true,
      message: 'Recovered successfully!',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

module.exports = router;
