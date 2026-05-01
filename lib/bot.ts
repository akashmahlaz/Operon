import { Chat } from "chat";
import { createMemoryState } from "@chat-adapter/state-memory";
import { useMultiFileAuthState as createMultiFileAuthState } from "baileys";
import { createBaileysAdapter } from "chat-adapter-baileys";


// 1. Load (or create) the session credentials
const { state, saveCreds } = await createMultiFileAuthState("./auth_info");
// 2. Create the adapter
const whatsapp = createBaileysAdapter({
  auth: { state, saveCreds },
  userName: "my-bot",
  // Called when a QR code is available — scan with WhatsApp → Linked Devices
  onQR: async (qr) => {
    const QRCode = await import("qrcode");
    console.log(await QRCode.toString(qr, { type: "terminal" }));
  },
});
// 3. Create the Chat instance
const bot = new Chat({
  userName: "my-bot",
  adapters: { whatsapp },
  state: createMemoryState(),
});
// 4. Register handlers
bot.onNewMention(async (thread, message) => {
  // Fires when the bot is @-mentioned in a group it hasn't subscribed to
  await thread.post(`Hello ${message.author.userName}!`);
  await thread.subscribe(); // subscribe so follow-up messages are also handled
});
bot.onSubscribedMessage(async (thread, message) => {
  // Fires for every message in a subscribed thread
  if (message.author.isMe) return;
  await thread.post(`You said: ${message.text}`);
});
bot.onNewMessage(/.+/, async (thread, message) => {
  // Fires for any message matching the pattern in an unsubscribed thread
  if (!thread.isDM || message.author.isMe) return;
  await thread.post(`DM received: ${message.text}`);
});
// 5. Initialize Chat so adapters are attached
await bot.initialize();
// 6. Connect — open the WhatsApp WebSocket
await whatsapp.connect();