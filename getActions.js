import { StreamerbotClient } from "@streamerbot/client";

async function getActions() {
  return await new Promise((resolve, reject) => {
    const SBClient = new StreamerbotClient({
      host: Deno.env.get("STREAMER_BOT_WS_SERVER_HOST"),
      port: Deno.env.get("STREAMER_BOT_WS_SERVER_PORT"),
      onConnect: async (_data) => {
        //console.log("Streamer.Bot Connection opened!");
        resolve((await SBClient.getActions()).actions);
        await SBClient.disconnect();
      },
      onDisconnect: () => {
        //console.log("Streamer.Bot Connection closed!");
        reject();
      },
      onError: (err) => {
        //console.log("Streamer.Bot Connection errored!", err);
        reject(err);
      },
    });
  });
}

const actions = await getActions();
for (let i = 0; i < actions.length; i++) {
  console.log(
    `${actions[i].id}: ${actions[i].name} (${
      actions[i].enabled ? "Enabled" : "Disabled"
    })`,
  );
}
