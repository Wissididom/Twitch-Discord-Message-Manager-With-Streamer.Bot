import * as DotEnv from "dotenv";
import { sanitizeUrl } from "./util.js";

DotEnv.config();

async function getActions() {
  let sanitizedUrl =
    sanitizeUrl(process.env["STREAMER_BOT_HTTP_SERVER"]) + "GetActions";
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
