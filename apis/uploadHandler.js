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
    const user = await User.findById(req.user);
    let starredTemp_1 = oldPath.split('\\');
    let starredTemp_2 = newPath.split('\\');
    const index_1 = starredTemp_1.indexOf(
      `${user.firstName}-${user.lastName}-${user._id}`,
    );
    const index_2 = starredTemp_1.indexOf(
      `${user.firstName}-${user.lastName}-${user._id}`,
    );

    starredTemp_1.splice(index_1, 0, 'starred');
    starredTemp_2.splice(index_2, 0, 'starred');
    starredTemp_1 = starredTemp_1.join('\\');
    starredTemp_2 = starredTemp_2.join('\\');

    if (fs.existsSync(newPath)) {
      return res.json({
        success: false,
        message: 'Name already exists!',
      });
    } else {
      await rename(oldPath, newPath);

      if (fs.existsSync(starredTemp_1)) {
        await rename(starredTemp_1, starredTemp_2);
      }
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
    console.log(payload, 'payload');
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
      } else if (shared.sharedPath.includes(user.folderPath)) {
        shared.sharedPath = [payload.path];

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
    console.log(shared, 'shared');
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
    const {
        folderName,
        userPath,
        customPath,
        userId = undefined,
        search = undefined,
      } = req.query,
      folderSize = util.promisify(getFolderSize),
      user = await User.findById(userId ? userId : req.user),
      readdir = util.promisify(fs.readdir),
      joinedPath =
        folderName && userPath
          ? path.join(userPath, folderName)
          : folderName
          ? path.join(user.folderPath, folderName)
          : userPath
          ? userPath
          : customPath && folderName
          ? path.join(customPath, folderName)
          : customPath
          ? customPath
          : user.folderPath,
      rawFiles = await readdir(joinedPath),
      files = [],
      folders = [],
      favFiles = [],
      favFolders = [];
    let file;

    if (!customPath) {
      let starredTemp = joinedPath.split('\\');
      const index = starredTemp.indexOf(
        `${user.firstName}-${user.lastName}-${user._id}`,
      );

      starredTemp.splice(index, 0, 'starred');
      starredTemp = starredTemp.join('\\');

      if (fs.existsSync(starredTemp)) {
        const rawFavs = await readdir(starredTemp);

        // favourite files & folders
        for (let i = 0; i < rawFavs.length; i++) {
          const readFile = util.promisify(fs.readFile);

          if (rawFavs[i].split('.').length === 2) {
            file = await readFile(path.join(starredTemp, rawFavs[i]));

            favFiles.push(path.basename(path.join(starredTemp, rawFavs[i])));
          } else {
            favFolders.push(rawFavs[i]);
          }
        }
      }
    }

    // files & folders
    for (let i = 0; i < rawFiles.length; i++) {
      const pattern = new RegExp(search, 'i');

      if (rawFiles[i].search(pattern) === -1) {
        continue;
      }

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
          createdAt: new Date(stats.ctime).toLocaleString(),
          updatedAt: new Date(stats.atime).toLocaleString(),
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
          favourite: favFiles.includes(
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
          updatedAt: new Date(stats.atime).toLocaleString(),
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
          favourite: favFolders.includes(rawFiles[i]),
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

// router.post('/shared', auth, async (req, res, next) => {
//   try {
//     const { path, search = undefined } = req.body,
//       folderSize = util.promisify(getFolderSize),
//       readdir = util.promisify(fs.readdir),
//       files = [],
//       folders = [],
//       readFiles = await readdir(path[0]);
//     let file, rawFiles;

//     console.log(readFiles, 'readFiles');

//     for (let i = 0; i < readFiles.length; i++) {
//       file = undefined;
//       rawFiles = undefined;

//       if (readFiles[i].split('.').length === 2) {
//         rawFiles = [readFiles[i]];

//         for (let i = 0; i < rawFiles.length; i++) {
//           console.log(rawFiles[i], 'rawFiles[i]');
//           const pattern = new RegExp(search, 'i');

//           if (rawFiles[i].search(pattern) === -1) {
//             continue;
//           }

//           const readFile = util.promisify(fs.readFile);
//           const { ...stats } = await fs.promises.stat(rawFiles[i]);

//           file = await readFile(rawFiles[i]);
//           files.push({
//             file: file.toString('base64'),
//             mimeType: mime.getType(path.basename(rawFiles[i])),
//             fileName: path.basename(rawFiles[i], path.extname(rawFiles[i])),
//             fileNameWithExt: path.basename(rawFiles[i]),
//             size: stats.size,
//             location: rawFiles[i],
//           });
//         }
//       } else {
//         rawFiles = readFiles[i];
//         console.log(readFiles[i], 'readFiles[i]');
//         const pattern = new RegExp(search, 'i');

//         if (rawFiles.search(pattern) === -1) {
//           return;
//         }

//         // rawFiles = await readdir(readFiles[i]);

//         // for (let j = 0; j < rawFiles.length; j++) {
//         //   const readFile = util.promisify(fs.readFile);
//         //   console.log(readFiles[i], 'readFiles[i]');
//         //   console.log(rawFiles[j], 'rawFiles[j]');
//         //   if (rawFiles[j].split('.').length === 2) {
//         //     const { ...stats } = await fs.promises.stat(
//         //       path.join(readFiles[i], rawFiles[j]),
//         //     );

//         //     file = await readFile(path.join(readFiles[i], rawFiles[j]));
//         //     files.push({
//         //       file: file.toString('base64'),
//         //       mimeType: mime.getType(
//         //         path.basename(path.join(readFiles[i], rawFiles[j])),
//         //       ),
//         //       fileName: path.basename(
//         //         path.join(readFiles[i], rawFiles[j]),
//         //         path.extname(path.join(readFiles[i], rawFiles[j])),
//         //       ),
//         //       fileNameWithExt: path.basename(path.join(readFiles[i], rawFiles[j])),
//         //       size: stats.size,
//         //       location: path.join(readFiles[i], rawFiles[j]),
//         //     });
//         //   } else {
//         folders.push({
//           size: await folderSize(rawFiles),
//           folderName: rawFiles,
//           location: rawFiles,
//         });
//         //     }
//         //   }
//       }
//     }

//     res.json({
//       success: true,
//       files,
//       folders,
//     });
//   } catch (error) {
//     console.log(error);

//     res.json({
//       success: false,
//       message: 'An error occurred!',
//     });
//   }
// });

router.post('/delete', auth, async (req, res, next) => {
  try {
    const { folder = false, customPath = undefined } = req.body;
    const unlink = util.promisify(fs.rm);

    // try {

    await unlink(customPath, {
      recursive: true,
    });

    res.json({
      success: true,
      message: `${folder ? 'Folder' : 'File'} deleted successfully!`,
    });
    // } catch (error) {
    //   console.log(error);

    //   res.json({
    //     success: false,
    //     message: 'Empty the folder first!',
    //   });
    // }
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
    // const rename = util.promisify(fs.rename);
    const folderSize = util.promisify(getFolderSize);
    const user = await User.findById(req.user);
    // let userFolderTemp = user.folderPath.split('\\');
    // let trashTemp = user.folderPath.split('\\');
    const unlink = util.promisify(fs.rm);
    // const mkdir = util.promisify(fs.mkdir);
    const cp = util.promisify(fs.cp);
    let starredTemp = oldPath.split('\\');
    const index = starredTemp.indexOf(
      `${user.firstName}-${user.lastName}-${user._id}`,
    );

    starredTemp.splice(index, 0, 'starred');
    starredTemp = starredTemp.join('\\');
    // trashTemp.pop();
    // trashTemp.splice(trashTemp.length, 0, 'trash');
    // userFolderTemp.splice(userFolderTemp.length - 1, 0, 'trash');

    // const userFolderDir = userFolderTemp.join('\\');
    // const trashDir = trashTemp.join('\\');

    // if (!fs.existsSync(trashDir)) {
    //   await mkdir(trashDir);
    //   await mkdir(userFolderDir);
    // } else if (!fs.existsSync(userFolderDir)) {
    //   await mkdir(userFolderDir);
    // }

    // await rename(oldPath, newPath);
    await cp(oldPath, newPath, { recursive: true });
    await unlink(oldPath, {
      recursive: true,
    });

    if (fs.existsSync(starredTemp))
      await unlink(starredTemp, {
        recursive: true,
      });

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

router.post('/stare', auth, async (req, res, next) => {
  try {
    const { oldPath, newPath } = req.body;
    const cp = util.promisify(fs.cp);
    const folderSize = util.promisify(getFolderSize);
    const user = await User.findById(req.user);
    // let userFolderTemp = user.folderPath.split('\\');
    // let starredTemp = user.folderPath.split('\\');
    // const mkdir = util.promisify(fs.mkdir);

    // starredTemp.pop();
    // starredTemp.splice(starredTemp.length, 0, 'starred');
    // userFolderTemp.splice(userFolderTemp.length - 1, 0, 'starred');

    // const userFolderDir = userFolderTemp.join('\\');
    // const starredDir = starredTemp.join('\\');

    // if (!fs.existsSync(starredDir)) {
    //   await mkdir(starredDir);
    //   await mkdir(userFolderDir);
    // } else if (!fs.existsSync(userFolderDir)) {
    //   await mkdir(userFolderDir);
    // }
    console.log(oldPath, 'oldPath');
    console.log(newPath, 'newPath');
    await cp(oldPath, newPath, { recursive: true });

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
      message: 'Added to favourites!',
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
    // const rename = util.promisify(fs.rename);
    const folderSize = util.promisify(getFolderSize);
    const user = await User.findById(req.user);
    const cp = util.promisify(fs.cp);
    const unlink = util.promisify(fs.rm);

    // await rename(oldPath, newPath);
    await cp(oldPath, newPath, { recursive: true });
    await unlink(oldPath, {
      recursive: true,
    });

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

router.post('/unstare', auth, async (req, res, next) => {
  try {
    const { customPath } = req.body;
    const unlink = util.promisify(fs.rm);

    await unlink(customPath, {
      recursive: true,
    });

    res.json({
      success: true,
      message: 'Removed from favourites!',
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: 'An error occurred!',
    });
  }
});

router.post('/moveorcopy', auth, async (req, res, next) => {
  try {
    const { oldPath, newPath, move = false, folder = false } = req.body;
    const cp = util.promisify(fs.cp);
    const user = await User.findById(req.user);
    const unlink = util.promisify(fs.rm);
    let starredTemp = oldPath.split('\\');
    let temp = oldPath.split('\\');
    const index = starredTemp.indexOf(
      `${user.firstName}-${user.lastName}-${user._id}`,
    );
    const mkdir = util.promisify(fs.mkdir);

    starredTemp.splice(index, 0, 'starred');
    starredTemp = starredTemp.join('\\');

    if (folder) mkdir(path.join(newPath, temp[temp.length - 1]));

    await cp(oldPath, path.join(newPath, temp[temp.length - 1]), {
      recursive: true,
    });

    if (move) {
      await unlink(oldPath, {
        recursive: true,
      });

      if (fs.existsSync(starredTemp))
        await unlink(starredTemp, {
          recursive: true,
        });
    }

    if (move) {
      res.json({
        success: true,
        message: 'Moved to new path successfully!',
      });
    } else {
      res.json({
        success: true,
        message: 'Copied to new path successfully!',
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

module.exports = router;
