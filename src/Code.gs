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