const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCHEMA_NAME = 'SeniorX';
const ATTRIBUTE_NAME = 'Username';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/admin.directory.user'];
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.error('Error loading client secret file', err);

  // Authorize a client with the loaded credentials, then call the  Directory API.
  authorize(JSON.parse(content), updateAllUsers);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oauth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oauth2Client, callback);
    oauth2Client.credentials = JSON.parse(token);
    callback(oauth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oauth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) return console.warn(`Token not stored to ${TOKEN_PATH}`, err);
    console.log(`Token stored to ${TOKEN_PATH}`);
  });
}

/**
 * Updates the custom attribute of all users in the domain.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function updateAllUsers(auth) {
  const service = google.admin({version: 'directory_v1', auth});
  try {
    const query = {
      customer: 'my_customer',
      maxResults: 50,
      projection: 'custom',
      customFieldMask: SCHEMA_NAME,
      orderBy: 'email',
    };
    var response = await service.users.list(query);

    const users = response.data.users;
    if (users.length) {
      updateUsers(service, users);
    }

    while (response.data.nextPageToken) {
      query['pageToken'] = response.data.nextPageToken;
      response = await service.users.list(query);
      const users = response.data.users;
      if (users.length) {
        updateUsers(service, users);
      }
    }

  } catch (err){
    console.log("Error fetching users: " + err.message);
  }
}

function updateUsers(service, users) {
  users.forEach(async (user) => {
    var username = user.primaryEmail.substring(0, user.primaryEmail.indexOf('@'));
    console.log(`Updating user ${username}`);
    if (!user['customSchemas']) {
      user['customSchemas'] = {};
      user['customSchemas'][SCHEMA_NAME] = {};
    }
    user['customSchemas'][SCHEMA_NAME][ATTRIBUTE_NAME] = username;        
    try {
      var updated = await service.users.update({
        userKey: user['id'],
        resource: user
      })
    } catch (err) {
      console.log("Error updating user: " + err.message);
    }
  });
}