import express from "express";
import dotenv from "dotenv";
import { Server as socketIOServer } from "socket.io"; // Corrected import statement
import mongoose from "mongoose";
import cors from "cors";
import ExpressError from "./utils/ExpressError.js";
import userRoute from "./routes/userRoute.js";
import chatRoute from "./routes/chatRoute.js";
import messageRoute from "./routes/messageRoute.js";
dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URL =
  process.env.MONGO_URL || "mongodb://127.0.0.1:27017/BlitzTalk";

const app = express();
app.use(express.json());
app.use(cors());

main()
  .then(() => {
    console.log("Connection to DB successful");
  })
  .catch((err) => {
    console.error("Error connecting to the database:", err);
    process.exit(1);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

app.get("/", (req, res) => {
  res.send("Welcome Home");
});

app.use("/api/chat", chatRoute);
app.use("/api/user", userRoute);
app.use("/api/message", messageRoute);

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not found!"));
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something Went Wrong!" } = err;
  res.status(statusCode).send(message);
});

const server = app.listen(PORT, () => {
  console.log(`Server responding on Port: ${PORT}`);
});

// Use the correct import to create the socket.io server instance
const io = new socketIOServer(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:5173",
  },
});

io.on("connection", (socket) => {
  console.log("New connection");
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    // console.log("User Joined Room1: " + userData._id);
    socket.emit("connected");
  });
  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));
  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;
    // console.log("Chat: ", chat);
    if (!chat.users) {
      console.log("chat.users not defined");
      return;
    }

    chat.users.forEach((user) => {
      if (user._id !== newMessageReceived.sender._id) {
        socket.in(user._id).emit("message recieved", newMessageReceived);
        // console.log('Checking')
      }
    });
  });

  socket.off("setup", () => {
    console.log("USER DISCONNECTED");
    socket.leave(userData._id);
  });
});
