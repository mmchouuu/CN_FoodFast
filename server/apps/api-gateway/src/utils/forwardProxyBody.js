const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hasBody(content) {
  if (content === undefined || content === null) return false;
  if (typeof content === 'string') {
    return content.length > 0;
  }
  if (Buffer.isBuffer(content)) {
    return content.length > 0;
  }
  if (typeof content === 'object') {
    return Object.keys(content).length > 0;
  }
  return false;
}

function forwardProxyBody(proxyReq, req) {
  if (!METHODS_WITH_BODY.has(req.method)) {
    return;
  }

  if (!hasBody(req.body)) {
    return;
  }

  let bodyData;
  if (Buffer.isBuffer(req.body)) {
    bodyData = req.body;
  } else if (typeof req.body === 'string') {
    bodyData = Buffer.from(req.body);
  } else {
    bodyData = Buffer.from(JSON.stringify(req.body));
    if (!proxyReq.getHeader('Content-Type')) {
      proxyReq.setHeader('Content-Type', 'application/json');
    }
  }

  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
  proxyReq.end();
}

module.exports = forwardProxyBody;

