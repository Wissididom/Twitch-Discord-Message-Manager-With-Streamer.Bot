import * as DotEnv from "dotenv";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import WebSocket from "ws";
import { sanitizeUrl } from "./util.js";

DotEnv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
  ],
}); // Discord Object

async function getActionName(actionId, onlyEnabled = true) {
  let sanitizedUrl =
    sanitizeUrl(process.env["STREAMER_BOT_HTTP_SERVER"]) + "GetActions";
  let response = await fetch(sanitizedUrl);
  if (response.status == 200) {
    let actions = (await response.json()).actions;
    for (let i = 0; i < actions.length; i++) {
      if (actions[i].id == actionId) {
        if (!onlyEnabled || (actions[i].enabled && onlyEnabled)) {
          return actions[i].name;
        }
      }
    }
    return null;
  } else {
    return new Promise.reject(
      "Non 200 response from Streamer.Bot's HTTP Server!",
    );
  }
}

async function doAction(actionId, actionName, args = null) {
  let sanitizedUrl =
    sanitizeUrl(process.env["STREAMER_BOT_HTTP_SERVER"]) + "DoAction";
  let body = null;
  if (args) {
    body = JSON.stringify({
      action: {
        id: actionId,
        name: actionName,
      },
      args,
      /*{
            "key": "value",
        }*/
    });
  } else {
    body = JSON.stringify({
      action: {
        id: actionId,
        name: actionName,
      },
      args: {},
    });
  }
  let response = await fetch(sanitizedUrl, {
    method: "POST",
    body: body,
  });
  if (response.status == 204) {
    return Promise.resolve();
  } else {
    return new Promise.reject(
      "Non 204 response from Streamer.Bot's HTTP Server!",
    );
  }
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild?.available) return;
  if (!interaction.guildId) return;
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("delete")) {
      let id = interaction.customId.substring("delete".length);
      let actionId = process.env["DELETE_ACTION_ID"];
      let actionName = await getActionName(actionId).catch(
        (err) => console.warn,
      );
      await doAction(actionId, actionName, {
        id: id,
      }).then(() => {
        interaction.reply("Told Streamer.Bot to run the delete action");
      });
    } else if (interaction.customId.startsWith("timeout")) {
      let username = interaction.customId.substring("timeout".length);
      let modal = new ModalBuilder()
        .setTitle("Timeout User")
        .setCustomId("timeoutModal")
        .setComponents(
          new ActionRowBuilder().setComponents(
            new TextInputBuilder()
              .setCustomId("timeoutDuration")
              .setLabel("Timeout Duration in Seconds")
              .setMaxLength(10)
              .setMinLength(1)
              .setPlaceholder("Timeout Duration in Seconds")
              .setStyle(TextInputStyle.Short),
          ),
          new ActionRowBuilder().setComponents(
            new TextInputBuilder()
              .setCustomId("timeoutReason")
              .setLabel("Timeout Reason")
              .setRequired(false)
              .setPlaceholder("Timeout Reason")
              .setStyle(TextInputStyle.Paragraph),
          ),
        );
      await interaction.showModal(modal);
      let submitted = await interaction
        .awaitModalSubmit({
          filter: (i) =>
            i.customId == "timeoutModal" && i.user.id == interaction.user.id,
          time: 60000,
        })
        .catch((err) => {
          console.error(err);
        });
      if (submitted) {
        let duration = submitted.fields.getTextInputValue("timeoutDuration");
        let reason = submitted.fields.getTextInputValue("timeoutReason");
        let actionId = process.env["TIMEOUT_ACTION_ID"];
        let actionName = await getActionName(actionId).catch(
          (err) => console.warn,
        );
        if (reason == undefined || reason == null || reason.trim() == "") {
          await doAction(actionId, actionName, {
            username: username,
            duration: duration,
          }).then(() => {
            submitted.reply("Told Streamer.Bot to run the timeout action");
          });
        } else {
          await doAction(actionId, actionName, {
            username: username,
            duration: duration,
            reason: reason,
          }).then(() => {
            submitted.reply("Told Streamer.Bot to run the timeout action");
          });
        }
      }
    } else if (interaction.customId.startsWith("ban")) {
      let username = interaction.customId.substring("ban".length);
      let modal = new ModalBuilder()
        .setTitle("Ban User")
        .setCustomId("banModal")
        .setComponents(
          new ActionRowBuilder().setComponents(
            new TextInputBuilder()
              .setCustomId("banReason")
              .setLabel("Ban Reason")
              .setRequired(false)
              .setPlaceholder("Ban Reason")
              .setStyle(TextInputStyle.Paragraph),
          ),
        );
      await interaction.showModal(modal);
      let submitted = await interaction
        .awaitModalSubmit({
          filter: (i) =>
            i.customId == "banModal" && i.user.id == interaction.user.id,
          time: 60000,
        })
        .catch((err) => {
          console.error(err);
        });
      if (submitted) {
        let reason = submitted.fields.getTextInputValue("banReason");
        let actionId = process.env["BAN_ACTION_ID"];
        let actionName = await getActionName(actionId).catch(
          (err) => console.warn,
        );
        if (reason == undefined || reason == null || reason.trim() == "") {
          await doAction(actionId, actionName, {
            username: username,
          }).then(() => {
            submitted.reply("Told Streamer.Bot to run the ban action");
          });
        } else {
          await doAction(actionId, actionName, {
            username: username,
            reason: reason,
          }).then(() => {
            submitted.reply("Told Streamer.Bot to run the ban action");
          });
        }
      }
    }
  }
});

// Bot Login
if (!process.env["TOKEN"]) {
  console.log(
    "TOKEN not found! You must setup the Discord TOKEN as per the README file before running this bot.",
  );
} else {
  client.login(process.env["TOKEN"]);
}

function connectstreamerbot() {
  const ws = new WebSocket(process.env["STREAMER_BOT_WS_SERVER"]);
  ws.onclose = (event) => {
    console.log("Streamer.Bot Connection closed!", event.code, event.reason);
    setTimeout(connectstreamerbot, 10000);
  };
  ws.onerror = (event) => {
    console.log("Streamer.Bot Connection errored!", event);
  };
  ws.onopen = (event) => {
    console.log("Streamer.Bot Connection opened!");
    ws.send(
      JSON.stringify({
        request: "Subscribe",
        events: {
          Twitch: ["ChatMessage"],
        },
        id: "discord-manager",
      }),
    );
  };
  ws.onmessage = async (event) => {
    // https://wiki.streamer.bot/en/Servers-Clients/WebSocket-Server/Events
    // grab message and parse JSON
    const msg = event.data;
    //console.log('msg:' + msg);
    const wsdata = JSON.parse(msg);
    // check for events to trigger
    if (!wsdata.event) return;
    if (wsdata.event.source == "Twitch") {
      if (wsdata.event.type == "ChatMessage") {
        let msgId = wsdata.data.message.msgId;
        //let userId = wsdata.data.message.userId;
        let displayName = wsdata.data.message.displayName;
        let username = wsdata.data.message.username;
        let nameToPost =
          displayName.toLowerCase() == username
            ? displayName
            : `${displayName} (${username})`;
        let message = wsdata.data.message.message;
        let dcChannel = await client.channels.fetch(process.env["CHANNEL_ID"]);
        if (dcChannel) {
          if (dcChannel.isTextBased()) {
            // https://discordjs.guide/message-components/buttons.html
            let deleteBtn = new ButtonBuilder()
              .setCustomId(`delete${msgId}`)
              .setLabel("Delete")
              .setStyle(ButtonStyle.Success);
            let timeoutBtn = new ButtonBuilder()
              .setCustomId(`timeout${username}`)
              .setLabel("Timeout")
              .setStyle(ButtonStyle.Danger);
            let banBtn = new ButtonBuilder()
              .setCustomId(`ban${username}`)
              .setLabel("Ban")
              .setStyle(ButtonStyle.Danger);
            let actionRow = new ActionRowBuilder().addComponents(
              deleteBtn,
              timeoutBtn,
              banBtn,
            );
            dcChannel.send({
              content: `${nameToPost}: ${message}`,
              components: [actionRow],
            });
          }
        }
      }
    }
  };
}

setTimeout(connectstreamerbot, 100);
