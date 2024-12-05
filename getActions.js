import "dotenv/config";

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

async function getActions() {
  let sanitizedUrl = sanitizeUrl(process.env["STREAMER_BOT_HTTP_SERVER"]) +
    "GetActions";
  let response = await fetch(sanitizedUrl);
  if (response.status == 200) {
    let actions = (await response.json()).actions;
    for (let i = 0; i < actions.length; i++) {
      console.log(
        `${actions[i].id}: ${actions[i].name} (${
          actions[i].enabled ? "Enabled" : "Disabled"
        })`,
      );
    }
  } else {
    return new Promise.reject(
      "Non 200 response from Streamer.Bot's HTTP Server!",
    );
  }
}

getActions();
