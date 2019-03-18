const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata', 'https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = 'token.json';

async function hasToken(clientId, clientSecret, redirectUri) {
    return new Promise(function (resolve, reject) {
        fs.readFile(TOKEN_PATH, async (err, token) => {
            if (err) {
                const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
                const authUrl = oAuth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: SCOPES,
                });
                resolve(authUrl);
            }
            else {
                let oAuth2Client = await getAuth(clientId, clientSecret, redirectUri, token);
                if (oAuth2Client.isTokenExpiring()) {
                    const authUrl = oAuth2Client.generateAuthUrl({
                        access_type: 'offline',
                        scope: SCOPES,
                    });
                    resolve(authUrl);
                }
                else {
                    resolve();
                }
            }
        });
    });
}

function authenticate(clientId, clientSecret, redirectUri, code, error) {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        //oAuth2Client.setCredentials(token);
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) console.error(err);
            console.log(`Token stored to ${TOKEN_PATH}s`);
        });
    });
}

async function getAuth(clientId, clientSecret, redirectUri, oldToken) {
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  let token = oldToken || fs.readFileSync(TOKEN_PATH);
  oAuth2Client.setCredentials(JSON.parse(token));
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

async function updateFile(auth, fileId, contents) {
  const drive = google.drive({version: 'v3', auth});
  let data = await drive.files.update({
      fileId: fileId,
      media: {
          mimeType: 'text/plain',
          body: contents
      }
  });
  return data;
}

module.exports = {
    hasToken: hasToken,
    authenticate: authenticate,
    getAuth: getAuth,
    listFiles: listFiles,
    createFile: createFile,
    updateFile: updateFile,
    createFolder: createFolder
};