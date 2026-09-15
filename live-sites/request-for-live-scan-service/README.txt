Request for Live Scan Service

Built by the publish-live-site skill from bcia8016-gui.json.
Open it through the dev server (npm start, or the flowchart-dev launch config):
  One question at a time: http://localhost:8080/live-sites/request-for-live-scan-service/index.html?mode=question
  One section at a time: http://localhost:8080/live-sites/request-for-live-scan-service/index.html?mode=section

By project id (the links to hand out - they follow the project, not this folder):
  One question at a time: http://localhost:8080/form/request-for-live-scan-service/question.html?saved=9-14-26_10-32pm
  One section at a time: http://localhost:8080/form/request-for-live-scan-service/section.html?saved=9-14-26_10-32pm

The PDFs are filled by the dev server's POST /edit_pdf, so opening index.html
as a file shows the form but cannot produce PDFs. This folder keeps its own
copies of the PDFs and of CountyLookup/ so it is complete on its own.
Rebuilding replaces this whole folder - do not edit it by hand.