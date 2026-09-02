/**
 * Prepare generated form HTML for standalone test payload folders.
 */
function preparePayloadHtml(html) {
  let out = String(html || '');
  out = out.replace(/<script src="https:\/\/js\.stripe\.com[^>]*><\/script>\s*/gi, '');
  out = out.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^>]*><\/script>\s*/gi, '');
  out = out.replace(/<script src="cart\.js"><\/script>\s*/gi, '');
  out = out.replace(/<script src="\.\.\/\.\.\/CountyLookup\/[^"]+"><\/script>\s*/gi, '');
  out = out.replace(
    /window\.__FORM_DEPLOYMENT_STYLE__\s*=\s*["'][^"']*["']/g,
    'window.__FORM_DEPLOYMENT_STYLE__="test"'
  );
  out = out.replace(/id="pdfDevTools" style="display:\s*none"/g, 'id="pdfDevTools" style="display: block"');
  out = out.replace(
    /id="productionCheckoutTools" style="display:\s*block"/g,
    'id="productionCheckoutTools" style="display: none"'
  );
  out = out.replace(/href="\.\.\/\.\.\/[^"]*"/g, 'href="#"');
  out = out.replace(/onclick="location\.href='(?:\.\.\/)+[^']*'[^"]*"/g, 'onclick="return false"');
  return out;
}

function sanitizePayloadFolderName(name) {
  return String(name || 'Form')
    .replace(/\.pdf$/i, '')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .trim() || 'Form';
}

module.exports = { preparePayloadHtml, sanitizePayloadFolderName };
