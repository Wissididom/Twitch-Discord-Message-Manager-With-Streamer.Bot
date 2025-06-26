import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  Message,
  ModalBuilder,
  Partials,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { StreamerbotClient } from "@streamerbot/client";

const messages: { [key: string]: Message } = {};

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
  host: Deno.env.get("STREAMER_BOT_WS_SERVER_HOST"),
  port: Deno.env.has("STREAMER_BOT_WS_SERVER_PORT")
    ? parseInt(Deno.env.get("STREAMER_BOT_WS_SERVER_PORT")!)
    : undefined,
  onConnect: async (_data) => {
    console.log("Streamer.Bot Connection opened!");
    await SBClient.on("Twitch.ChatMessageDeleted", async (data) => {
      console.log("Twitch Chat Message deleted:", data);
      if (messages[data.data.targetMessageId]) {
        console.log(messages[data.data.targetMessageId]);
        await messages[data.data.targetMessageId].delete();
        delete messages[data.data.targetMessageId];
        console.log(messages[data.data.targetMessageId]);
      }
    });
    await SBClient.on("Twitch.ChatCleared", async (data) => {
      console.log("Twitch Chat Cleared:", data);
      const indexedMessages = [];
      let channel = null;
      for (const key of Object.keys(messages)) {
        if (messages[key].channel) channel = messages[key].channel;
        indexedMessages.push(messages[key]);
        delete messages[key];
      }
      try {
        if (
          channel && "bulkDelete" in channel &&
          typeof channel.bulkDelete === "function"
        ) await channel.bulkDelete(indexedMessages);
      } catch (error) {
        console.error("Failed to bulk delete messages (ChatCleared):", error);
      }
    });
    await SBClient.on("Twitch.UserBanned", async (data) => {
      console.log("Twitch User Banned:", data);
      const displayName = data.data.user_name; // TODO: Check type and if Streamer.Bot complies with the type definitions
      const username = data.data.user_login; // TODO: Check type and if Streamer.Bot complies with the type definitions
      const nameToPost = displayName.toLowerCase() == username
        ? displayName
        : `${displayName} (${username})`;
      const indexedMessages = [];
      let channel = null;
      for (const key of Object.keys(messages)) {
        if (messages[key].content.startsWith(`\`\`${nameToPost}\`\``)) {
          if (messages[key].channel) channel = messages[key].channel;
          indexedMessages.push(messages[key]);
          delete messages[key];
        }
      }
      try {
        if (
          channel && "bulkDelete" in channel &&
          typeof channel.bulkDelete === "function"
        ) await channel.bulkDelete(indexedMessages);
      } catch (error) {
        console.error("Failed to bulk delete messages (UserBanned):", error);
      }
    });
    await SBClient.on("Twitch.UserTimedOut", async (data) => {
      console.log("Twitch User TimedOut:", data);
      const displayName = data.data.user_name; // TODO: Check type and if Streamer.Bot complies with the type definitions
      const username = data.data.user_login; // TODO: Check type and if Streamer.Bot complies with the type definitions
      const nameToPost = displayName.toLowerCase() == username
        ? displayName
        : `${displayName} (${username})`;
      const indexedMessages = [];
      let channel = null;
      for (const key of Object.keys(messages)) {
        if (messages[key].content.startsWith(`\`\`${nameToPost}\`\``)) {
          if (messages[key].channel) channel = messages[key].channel;
          indexedMessages.push(messages[key]);
          delete messages[key];
        }
      }
      try {
        if (
          channel && "bulkDelete" in channel &&
          typeof channel.bulkDelete === "function"
        ) await channel.bulkDelete(indexedMessages);
      } catch (error) {
        console.error("Failed to bulk delete messages (UserTimedOut):", error);
      }
    });
    await SBClient.on("Twitch.ChatMessage", async (data) => {
      console.log("New Twitch Chat Message:", data);
      const msgId = data.data.message.msgId;
      //const userId = data.data.message.userId;
      const displayName = data.data.message.displayName;
      const username = data.data.message.username;
      const nameToPost = displayName.toLowerCase() == username
        ? displayName
        : `${displayName} (${username})`;
      const message = data.data.message.message;
      const dcChannel = Deno.env.has("CHANNEL_ID")
        ? await client.channels.fetch(Deno.env.get("CHANNEL_ID")!)
        : undefined;
      if (
        dcChannel && "send" in dcChannel && typeof dcChannel.send === "function"
      ) {
        if (dcChannel.isTextBased()) {
          // https://discordjs.guide/message-components/buttons.html
          const deleteBtn = new ButtonBuilder()
            .setCustomId(`delete${msgId}`)
            .setLabel("Delete")
            .setStyle(ButtonStyle.Success);
          const timeoutBtn = new ButtonBuilder()
            .setCustomId(`timeout${username}`)
            .setLabel("Timeout")
            .setStyle(ButtonStyle.Danger);
          const banBtn = new ButtonBuilder()
            .setCustomId(`ban${username}`)
            .setLabel("Ban")
            .setStyle(ButtonStyle.Danger);
          const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            deleteBtn,
            timeoutBtn,
            banBtn,
          );
          try {
            const dcMessage = await dcChannel.send({
              content: `\`\`${nameToPost}\`\`: \`\`${message}\`\``,
              components: [actionRow],
            });
            messages[msgId] = dcMessage;
          } catch (error) {
            console.error("Failed to bulk send message:", error);
          }
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

async function doAction(
  actionId: string,
  // deno-lint-ignore no-explicit-any
  args: Record<string, any> | null = null,
) {
  if (!args) args = {};
  return await SBClient.doAction(actionId, args);
}

client.on(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.guild?.available) return;
  if (!interaction.guildId) return;
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("delete")) {
      const id = interaction.customId.substring("delete".length);
      if (!Deno.env.has("DELETE_ACTION_ID")) return;
      const actionId = Deno.env.get("DELETE_ACTION_ID")!;
      await doAction(actionId, {
        id: id,
      }).then(() => {
        interaction.reply("Told Streamer.Bot to run the delete action");
      });
    } else if (interaction.customId.startsWith("timeout")) {
      const username = interaction.customId.substring("timeout".length);
      const modal = new ModalBuilder()
        .setTitle("Timeout User")
        .setCustomId("timeoutModal")
        .setComponents(
          new ActionRowBuilder<TextInputBuilder>().setComponents(
            new TextInputBuilder()
              .setCustomId("timeoutDuration")
              .setLabel("Timeout Duration in Seconds")
              .setMaxLength(10)
              .setMinLength(1)
              .setPlaceholder("Timeout Duration in Seconds")
              .setStyle(TextInputStyle.Short),
          ),
          new ActionRowBuilder<TextInputBuilder>().setComponents(
            new TextInputBuilder()
              .setCustomId("timeoutReason")
              .setLabel("Timeout Reason")
              .setRequired(false)
              .setPlaceholder("Timeout Reason")
              .setStyle(TextInputStyle.Paragraph),
          ),
        );
      await interaction.showModal(modal);
      const submitted = await interaction
        .awaitModalSubmit({
          filter: (i) =>
            i.customId == "timeoutModal" && i.user.id == interaction.user.id,
          time: 60000,
        })
        .catch((err) => {
          console.error(err);
        });
      if (submitted) {
        const duration = submitted.fields.getTextInputValue("timeoutDuration");
        const reason = submitted.fields.getTextInputValue("timeoutReason");
        if (!Deno.env.has("TIMEOUT_ACTION_ID")) return;
        const actionId = Deno.env.get("TIMEOUT_ACTION_ID")!;
        if (reason == undefined || reason == null || reason.trim() == "") {
          await doAction(actionId, {
            username: username,
            duration: duration,
          }).then(() => {
            submitted.reply("Told Streamer.Bot to run the timeout action");
          });
        } else {
          await doAction(actionId, {
            username: username,
            duration: duration,
            reason: reason,
          }).then(() => {
            submitted.reply("Told Streamer.Bot to run the timeout action");
          });
        }
      }
    } else if (interaction.customId.startsWith("ban")) {
      const username = interaction.customId.substring("ban".length);
      const modal = new ModalBuilder()
        .setTitle("Ban User")
        .setCustomId("banModal")
        .setComponents(
          new ActionRowBuilder<TextInputBuilder>().setComponents(
            new TextInputBuilder()
              .setCustomId("banReason")
              .setLabel("Ban Reason")
              .setRequired(false)
              .setPlaceholder("Ban Reason")
              .setStyle(TextInputStyle.Paragraph),
          ),
        );
      await interaction.showModal(modal);
      const submitted = await interaction
        .awaitModalSubmit({
          filter: (i) =>
            i.customId == "banModal" && i.user.id == interaction.user.id,
          time: 60000,
        })
        .catch((err) => {
          console.error(err);
        });
      if (submitted) {
        const reason = submitted.fields.getTextInputValue("banReason");
        if (!Deno.env.has("BAN_ACTION_ID")) return;
        const actionId = Deno.env.get("BAN_ACTION_ID")!;
        if (reason == undefined || reason == null || reason.trim() == "") {
          await doAction(actionId, {
            username: username,
          }).then(() => {
            submitted.reply("Told Streamer.Bot to run the ban action");
          });
        } else {
          await doAction(actionId, {
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

const token = Deno.env.get("TOKEN");

// Bot Login
if (!token) {
  console.log(
    "TOKEN not found! You must setup the Discord TOKEN as per the README file before running this bot.",
  );
} else {
  client.login(token);
}
