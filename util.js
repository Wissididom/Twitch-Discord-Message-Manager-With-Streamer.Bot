function sanitizeUrl(url) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "http://" + url;
  }
  url = url.replace("///", "//");
  if (!url.endsWith("/")) {
    url += "/";
  }
  return url;
}

export { sanitizeUrl };
