/**
 * Prepare generated form HTML for standalone test payload folders.
 *
 * A test page never uses Firebase - it exists to check that the form is built
 * right, and nothing typed into it is meant to be saved - so Firebase goes,
 * with Stripe and the cart.
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
