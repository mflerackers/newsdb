const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata', 'https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = 'token.json';

function hasToken(clientId, clientSecret, redirectUri, token) {
    if (token) {
        const oAuth2Client = getAuth(clientId, clientSecret, redirectUri, token);
        if (oAuth2Client.isTokenExpiring()) {
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
            });
            return authUrl;
        }
        else {
            return true;
        }
    }
    else {
        const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        return authUrl;
    }
}

function authenticate(clientId, clientSecret, redirectUri, code, error) {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    return new Promise(function(resolve, reject) {
        oAuth2Client.getToken(code, (err, token)=>{
            console.log(`getToken returned ${token} ${err}`);
            if (err) {
                reject(err);
            }
            else {
                resolve(token);
            }
        });
    });
}

function getAuth(clientId, clientSecret, redirectUri, token) {
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

async function listFiles(auth, query="name='Test'") {
  const drive = google.drive({version: 'v3', auth});
  let files = await drive.files.list({
      pageSize: 10,
      fields: 'nextPageToken, files(id, name)',
      q: query
  });
  console.log(`listFiles returned ${JSON.stringify(files)}`);
  return files.data.files;
}

async function createFile(auth, name, mime, contents, parents) {
  const drive = google.drive({version: 'v3', auth});
  let data = await drive.files.create({
      requestBody: {
          name: name,
          mimeType: mime,
          parents: parents
      },
      media: {
          mimeType: mime,
          body: contents
      }
  });
  return data;
}

async function updateFile(auth, fileId, mime, contents) {
    const drive = google.drive({version: 'v3', auth});
    let data = await drive.files.update({
        fileId: fileId,
        media: {
            mimeType: mime,
            body: contents
        }
    });
    return data;
}

async function createOrUpdateFile(auth, name, mime, contents, parents) {
    let q = [`name='${name}'`, ...parents.map(p => `'${p}' in parents`)].join(" and ");
    console.log(q);
    let files = await listFiles(auth, q);
    if (!files || files.length == 0) {
        let data = await createFile(auth, name, mime, contents, parents);
        console.log(`created ${JSON.stringify(data)}`);
        return data.data.id;
    }
    else {
        let data = await updateFile(auth, files[0].id, mime, contents);
        console.log(`updated ${JSON.stringify(data)}`);
        return files[0].id;
    }
}

async function createFolder(auth, name) {
  const drive = google.drive({version: 'v3', auth});
  let data = await drive.files.create({
      resource: {
          name: name,
          mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
  });
  return data.id;
}

async function getFolder(auth, name) {
    let folders = await listFiles(auth, `name='${name}'`);
    let id;
    if (!folders || folders.length == 0) {
        id = await createFolder(auth, name);
    }
    else {
        id = folders[0].id;
    }
    return id;
}

module.exports = {
    hasToken: hasToken,
    authenticate: authenticate,
    getAuth: getAuth,
    listFiles: listFiles,
    createFile: createFile,
    updateFile: updateFile,
    createOrUpdateFile: createOrUpdateFile,
    createFolder: createFolder,
    getFolder: getFolder
};