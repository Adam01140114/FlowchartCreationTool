#!/usr/bin/env node
/**
 * The public server: what a host such as Render runs (`node server.js`).
 *
 * It is dev-server.js in public mode (FORMWIZ_PUBLIC=1). A public host serves
 * only what a filer and a viewer need - the published forms under
 * /form/<project>/, the PDFs they fill (POST /edit_pdf), a read-only view of a
 * form's flowchart, and a page listing the forms - and answers everything else
 * 404: the editor's saving, the builder, publishing and every other /api route
 * stay on the private server (`npm start`, which runs dev-server.js itself).
 *
 * This repo's root server.js used to be the FormWiz site server; commit 3137ae8
 * removed it, and every Render deploy after that failed with "Cannot find module
 * .../server.js".
 */
process.env.FORMWIZ_PUBLIC = process.env.FORMWIZ_PUBLIC || '1';
require('./dev-server.js');
