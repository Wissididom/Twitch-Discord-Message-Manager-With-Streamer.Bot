import "dotenv/config";
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
import { StreamerbotClient } from "@streamerbot/client";

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

const SBClient = new StreamerbotClient({
  host: process.env.STREAMER_BOT_WS_SERVER_HOST,
  port: process.env.STREAMER_BOT_WS_SERVER_PORT,
  onConnect: async (data) => {
    console.log("Streamer.Bot Connection opened!");
    await SBClient.on("Twitch.ChatMessage", async (data) => {
      console.log("New Twitch Chat Message:", data);
      let msgId = data.data.message.msgId;
      //let userId = data.data.message.userId;
      let displayName = data.data.message.displayName;
      let username = data.data.message.username;
      let nameToPost =
        displayName.toLowerCase() == username
          ? displayName
          : `${displayName} (${username})`;
      let message = data.data.message.message;
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
            content: `\`\`${nameToPost}\`\`: \`\`${message}\`\``,
            components: [actionRow],
          });
        }
      }
    });
  },
  onDisconnect: () => {
    console.log("Streamer.Bot Connection closed!");
  },
  onError: (err) => {
    console.log("Streamer.Bot Connection errored!", err);
  },
});

async function getActions() {
  return SBClient.getActions();
}

async function doAction(actionId, args = null) {
  if (!args) args = {};
  return SBClient.doAction(actionId, args);
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
