This directory contains example code for connecting to an SSRA (or SimplySNAP
Cloud) managed gateway via the SSRA connection.

To run this code:

 1. Edit the `src/index.js` file and provide values for the `USERNAME`, `PASSWORD`,
    `SSRA_HOSTNAME`, and `GATEWAY_NAME` variables. `USERNAME` and `PASSWORD` are the email
    address and password that they use to log in to SSRA or SimplySNAP Cloud.
    `SSRA_HOSTNAME` is one of `simplysnap.snaplighting.com` (for SSRA) or
    `ssra.simplysnapcloud.com` (for SimplySNAP Cloud). The `GATEWAY_NAME` is the
    human readable name assigned to this gateway by SSRA.

 2. Install the dependencies for this NodeJS program by running `npm install` in
    the top-level directory (i.e. where the `package.json` file is).

 3. Run the sample program by typing `npm run start`.
