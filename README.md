# HTTapp Entity and Asset Manager
A web app designed for managing the remote resources the [Tree Trail app](https://github.com/owendanke/tree-trail-app) uses.

This project uses [clasp](https://github.com/google/clasp) to develop locally and make use of version control!

Some clasp commands to push to GAS:
 
 1. login with `clasp login`
 2. use `clasp pull` to pull the files from Google
 3. `clasp push` will send and replace the files at Google
 4. logout with `clasp logout`


 - `clasp` requres a file called `.clasp.json` in the active directory with this as its contents: `{"scriptId":"SCRIPTID"}`, here SCRIPTID is replaced with the GAS ID.

Or just check out this guide [Google clasp guide](https://developers.google.com/apps-script/guides/clasp)