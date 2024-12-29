require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Client, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();
const { GoogleGenerativeAI, Chat } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const cleanupFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error("Error cleaning up file:", error);
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "video/mp4"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only jpg, png, gif, and mp4 files are allowed."
        )
      );
    }
  },
});

// Middleware
app.use(
  cors({
    origin: true, // Allow all origins
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Length", "X-Requested-With"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};


// WhatsApp client setup
const client = new Client({
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});


let qrCode = null;
let isClientReady = false;
//let codePairing = null;

let pairingCodeRequested = false;
// WhatsApp client events

client.on("qr", async (qr) => {
  qrCode = qr;
  qrcode.generate(qr, { small: true });

  console.log("New QR code generated");

});

  

// Endpoint untuk menerima pairing code
app.post('/pairing', async (req, res) => {
  const { pairingNumber } = req.body;
  console.log("Nomor: " + pairingNumber);
  if (!pairingNumber) {
    return res.status(400).send({ message: 'Pairing number is required' });
  }

  try {
    // Panggil fungsi pairing dengan nomor yang diberikan
    const pairingCode = await client.requestPairingCode(pairingNumber);
    res.status(200).send({ pairingCode });

    console.log("Pairing code enabled, code: " + pairingCode);
    
    pairingCodeRequested = true;


  } catch (error) {
    console.error('Error requesting pairing code:', error);
    res.status(500).send({ message: 'Failed to request pairing code' });
  }
});


client.on("ready", () => {
  console.log("WhatsApp client is being ready!");
  isClientReady = true;
  console.log("WhatsApp client is on the process ready!");
  qrCode = null;
  console.log("WhatsApp client is ready!");
});

//auto response

// Baca file JSON
const menuData = JSON.parse(fs.readFileSync("./menuData.json", "utf-8"));
const userSessions = {}; // Objek untuk menyimpan status pengguna sementara

client.on("message", async (message) => {
  const userId = message.from;
  const receivedText = message.body.toLowerCase().trim();
  let chat = await message.getChat();
  let contact = await chat.getContact();
  if (contact.isGroup === true) {
    console.log("Ignoring group message");
    return;
  } else {
    if (!userSessions[userId]) {
      // Jika pengguna baru, tetapkan ke menu utama
      userSessions[userId] = "menu_utama";
    }
    const currentSession = userSessions[userId];
    const currentMenu = menuData[currentSession];

    if (currentMenu.next && currentMenu.next[receivedText]) {
      userSessions[userId] = currentMenu.next[receivedText]; // Perbarui status
      const nextMenu = menuData[userSessions[userId]];
      message.reply(nextMenu.response);
    } else {
      console.error("This problem is related to Model Limitations and API Rate Limits");
    }
  } catch (error) {
    console.error("Error in run function:", error);
    await sendWhatsAppMessage("Oops, an error occurred. Please try again later.", senderNumber);
  }
}

async function sendWhatsAppMessage(text, toNumber) {
  try {
    await client.sendMessage(toNumber, text);
  } catch (err) {
    console.error("Failed to send WhatsApp message:");
    console.error("Error details:", err);
  }
});

//end

client.on("disconnected", () => {
  isClientReady = false;
  console.log("WhatsApp client disconnected");
});

client.initialize(
  () => {
    console.log("WhatsApp client initialized");
  },
  (error) => {
    console.error("WhatsApp client initialization error:", error);
  }
);

// Routes
app.get("/api/whatsapp-status", authenticateToken, (req, res) => {
  res.json({
    isConnected: isClientReady,
    qrCode: !isClientReady ? qrCode : null,
   // codePairing: !isClientReady ? codePairing : null,
  });
});

app.get("/", (req, res) => {
  res.send("Welcome to Whatsapp Bulk Message App!");
});
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  console.log("Login attempt:", { username, password }); // For debugging

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required",
    });
  }

  try {
    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign({ username }, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      return res.json({
        success: true,
        token,
        message: "Login successful",
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

app.post(
  "/api/send-messages",
  authenticateToken,
  upload.single("media"),
  async (req, res) => {
    if (!isClientReady) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client not connected",
      });
    }

    try {
      const { campaignName, messageTemplate } = req.body;
      let contacts;

      try {
        contacts = JSON.parse(req.body.contacts);
        console.log("Parsed contacts:", contacts); // Debug log
      } catch (error) {
        console.error("Error parsing contacts:", error);
        return res.status(400).json({
          success: false,
          message: "Invalid contacts data format",
        });
      }

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid contacts provided",
        });
      }

      if (!campaignName || !messageTemplate) {
        return res.status(400).json({
          success: false,
          message: "Missing campaign name or message template",
        });
      }

      const mediaFile = req.file;
      let mediaData = null;

      if (mediaFile) {
        try {
          mediaData = MessageMedia.fromFilePath(mediaFile.path);
        } catch (error) {
          console.error("Error loading media file:", error);
          return res.status(500).json({
            success: false,
            message: "Error processing media file",
          });
        }
      }

      const results = [];
      const errors = [];

      for (const contact of contacts) {
        try {
          if (!contact.name || !contact.phoneNumber) {
            errors.push({
              contact,
              error: "Missing name or phone number",
            });
            continue;
          }

          const personalizedMessage = messageTemplate.replace(
            /{name}/g,
            contact.name
          );
          let phoneNumber = contact.phoneNumber.toString().trim();

          // Remove any non-numeric characters
          phoneNumber = phoneNumber.replace(/\D/g, "");

          // Add country code if not present (assuming default country code is 1)
          if (phoneNumber.length === 10) {
            phoneNumber = "1" + phoneNumber;
          }

          // Validate phone number format
          if (phoneNumber.length < 10 || phoneNumber.length > 15) {
            errors.push({
              contact,
              error: "Invalid phone number format",
            });
            continue;
          }

          const chatId = `${phoneNumber}@c.us`;
          console.log(`Sending message to ${chatId}`); // Debug log

          if (mediaData) {
            await client.sendMessage(chatId, mediaData, {
              caption: personalizedMessage,
            });
          } else {
            await client.sendMessage(chatId, personalizedMessage);
          }

          results.push({
            contact,
            status: "success",
          });

          // Add delay between messages to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(
            `Error sending message to ${contact.phoneNumber}:`,
            error
          );
          errors.push({
            contact,
            error: error.message,
          });
        }
      }

      // Cleanup media file if it exists
      if (mediaFile && mediaFile.path) {
        cleanupFile(mediaFile.path);
      }

      // Prepare detailed response
      const response = {
        success: true,
        campaignName,
        totalContacts: contacts.length,
        successfulMessages: results.length,
        failedMessages: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      };

      console.log("Campaign results:", response); // Debug log
      res.json(response);
    } catch (error) {
      console.error("Campaign error:", error);

      if (mediaFile && mediaFile.path) {
        cleanupFile(mediaFile.path);
      }

      res.status(500).json({
        success: false,
        message: "Error processing campaign",
        error: error.message,
      });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
