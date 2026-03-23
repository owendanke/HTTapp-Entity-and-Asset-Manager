/**
 * Code.gs
 * -------
 * Entry point for the HTTapp Asset Manager Google Apps Script Web App.
 * Handles HTTP GET requests — serves the app or routes the OAuth callback.
 */

/**
 * Main HTTP GET handler.
 *
 * Two cases are handled:
 *   1. Normal page load    → serve index.html (the Asset Manager UI)
 *   2. OAuth2 callback     → ?code=... or ?stub_auth=1 from Google's redirect
 *      Routes to authCallback() in Auth.gs which returns a self-closing popup.
 *
 * @param {Object} e - GAS request event object.
 * @returns {HtmlOutput}
 */
function doGet(e) {
  console.log('[Code.gs] doGet() called — serving HTTapp Asset Manager');
  const template = HtmlService.createTemplateFromFile('index');
  template.appTitle = CONFIG.APP_TITLE;
  return template
    .evaluate()
    .setTitle(CONFIG.APP_TITLE)
    .setFaviconUrl(`https://drive.google.com/uc?id=${CONFIG.FAV_ID}&export=download&format=png`)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes an HTML file partial by name.
 * Used in index.html as: <?!= include('Styles'); ?>
 *
 * @param {string} filename - Name of the .html file (without extension).
 * @returns {string} Raw HTML/CSS/JS content to be inlined.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Convert a base64 number to a hex number.
 * @param {string} base64 
 * @returns {string} hex
 */
function base64ToHex(base64) {
  // 1. Decode the Base64 string into a byte array.
  const bytes = Utilities.base64Decode(base64);

  // 2. Convert each byte in the array to its two-digit hexadecimal representation.
  const hexArray = bytes.map(function(byte) {
    // Convert byte to hex string (0-255).
    const hex = (byte & 0xFF).toString(16);
    // Ensure two digits by padding with a leading zero if necessary.
    return (hex.length === 1) ? '0' + hex : hex;
  });

  // 3. Join the array of hex strings into a single string and convert to uppercase for standard formatting.
  return hexArray.join('').toUpperCase();
}

function base64FromDataUrl(dataUrl) {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}