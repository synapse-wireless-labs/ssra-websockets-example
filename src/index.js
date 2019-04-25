const axios = require('axios');
const setCookie = require('set-cookie-parser');
const WebSocketClient = require('websocket').client;
const url = require('url');

const USERNAME = 'first.last@email.com';
const PASSWORD = 'password1';
const SSRA_HOSTNAME = 'ssra.simplysnapcloud.com';
const GATEWAY_NAME = `Gateway Name`;

async function login(username, password) {
  return axios.post(`https://${SSRA_HOSTNAME}/auth/local`, {
    email: username,
    password: password,
  });
}

/**
 * Parse the SSRA session ID out of the response cookies.
 */
function getSessionId(response) {
  const cookies = setCookie.parse(response.headers['set-cookie'], {
    decodeValues: true,
    map: true,
  });
  return cookies['sessionid'] && cookies['sessionid']['value'];
}

/**
 * Return the list of gateways this SSRA user can access.
 */
async function getGateways(token) {
  const response = await axios.get(`https://${SSRA_HOSTNAME}/api/v1/gateways/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

/**
 * Look up an SSRA gateway given its assigned name in SSRA.
 */
async function getGatewayByName(token, gatewayName) {
  const gateways = await getGateways(token);
  return gateways.find(gateway => gateway.name === gatewayName);
}

async function getConnectionUrl(token, gatewayId) {
  const response = await axios.get(
    `https://${SSRA_HOSTNAME}/api/v1/connections/${gatewayId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data.url;
}

/**
 * Extract the gateway-specific SSO token from the connection parameters generated
 * by SSRA.
 *
 * The URL will look something like this:
 *
 *     http://gateway-62c256.spogforthe.win:8080/?token=A6sm3wz%2B0NTb%2FsOeTYQdnlQv%2BZG5C1unSE%2FEY8VyGxY%3D&nonce=f5096791-582a-41fd-bdf8-051948995dd7&sessionid=
 *
 * We want to pull out the `token` query parameter's value and return it.
 */
function extractToken(connection_url) {
  var queryArgs = url.parse(connection_url, true).query;
  return queryArgs.token;
}

/**
 * Extract the SSO nonce from the connection parameters generated
 * by SSRA.
 *
 * The URL will look something like this:
 *
 *     http://gateway-62c256.spogforthe.win:8080/?token=A6sm3wz%2B0NTb%2FsOeTYQdnlQv%2BZG5C1unSE%2FEY8VyGxY%3D&nonce=f5096791-582a-41fd-bdf8-051948995dd7&sessionid=
 *
 * We want to pull out the `nonce` query parameter's value and return it.
 */
function extractNonce(connection_url) {
  var queryArgs = url.parse(connection_url, true).query;
  return queryArgs.nonce;
}

/**
 * Establish a connection to SimplySNAP OnPrem's lightsocket.
 */
function connect(hostname, userCookie, sessionId) {
  const client = new WebSocketClient();

  client.on('connectFailed', error => {
    console.log('Connect Error: ${error}');
  });

  client.on('connect', function(connection) {
    console.log('WebSocket Client Connected');

    /**
     * Send the gateway a list of message types to subscribe to.
     * create, update and delete correspond to CRUD actions
     * sensor_value messages are sent when a sensor's reading/state changes (i.e. daylight -> darkness)
     * zone_control messages are sent when a zone's level/behavior is changed
     * There are other message types, but these are the most useful.
     */
    subscription = {
      'type': 'subscribe',
      'data': ['create', 'update', 'delete', 'sensor_value', 'zone_control']
    };
    connection.send(JSON.stringify(subscription));

    connection.on('error', function(error) {
      console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
      console.log('Connection Closed');
    });
    connection.on('message', function(message) {
      if (message.type === 'utf8') {
        console.log("Received: '" + message.utf8Data + "'");
      }
    });
  });

  var headers = {
    Cookie: `user=${userCookie}; sessionid=${sessionId}`,
  }

  var ws_url = 'wss://' + hostname + '/lightsocket/websocket'

  client.connect(ws_url, null, null, headers, 'echo-protocol');
}

/**
 * Given an HTTP response from SimplySNAP OnPrem, parse out the
 * value of its "user" cookie.
 */
function getSimplySnapUserCookie(response) {
  const cookies = setCookie.parse(response.headers['set-cookie'], {
    decodeValues: true,
    map: true,
  });
  return cookies['user'] && cookies['user']['value'];
}

async function main() {
  console.log('Logging in to SSRA...')
  const loginResponse = await login(USERNAME, PASSWORD);
  console.log('Logged in!')
  const authToken = loginResponse.data.token;

  const sessionId = getSessionId(loginResponse);

  const gateway = await getGatewayByName(authToken, GATEWAY_NAME);

  if (!gateway) {
    console.error(`No such gateway: ${GATEWAY_NAME}`);
    process.exit(0);
  }

  const connection_url = await getConnectionUrl(authToken, gateway.id);
  const nonce = extractNonce(connection_url);
  const token = extractToken(connection_url);

  const response = await axios.get(
    `https://${gateway.hostname}?token=${token}&nonce=${nonce}&sessionid=${sessionId}`,
    {
      headers: { Authorization: `Bearer ${authToken}` },
    },
  );
  const user = getSimplySnapUserCookie(response);

  console.log('Connecting to websocket endpoint...')
  connect(
    gateway.hostname,
    user,
    sessionId,
  );

  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), 5000);
  });
}

(async function() {
  await main();
})();
