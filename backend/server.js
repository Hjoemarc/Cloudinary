// Load secret environment variables from the .env file (e.g., MONGODB_URI, PORT)
require("dotenv").config({
  path: __dirname + "/.env",
});

const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");

const app = express();

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================

// 1. Enable CORS: Allows your Expo app (web or mobile) to communicate with this server
app.use(cors());

// 2. Body Parser: Allows Express to read incoming JSON data sent inside `req.body`
app.use(express.json());

// 3. Request Logger: Prints every request to your terminal (essential for debugging!)
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// DATABASE CONNECTION & SERVER START
// ==========================================

const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
  try {
    // Connect to MongoDB Atlas
    await client.connect();
    console.log("✅ MongoDB Connected successfully!");

    const db = client.db("studentDB");
    const studentsCollection = db.collection("students");

    // ----------------------------------------------------
    // ROUTE 1: GET /students
    // Purpose: Retrieve all student records from MongoDB
    // ----------------------------------------------------
    app.get("/students", async (req, res) => {
      try {
        const students = await studentsCollection.find({}).toArray();
        res.json(students);
      } catch (error) {
        console.error("❌ Failed to fetch students:", error);
        res.status(500).json({ error: "Failed to fetch students from database" });
      }
    });

    // ----------------------------------------------------
    // ROUTE 2: PUT /students/:id/photo
    // Purpose: Update the student's profile photo URL in MongoDB
    // ----------------------------------------------------
    app.put("/students/:id/photo", async (req, res) => {
      try {
        const { id } = req.params;
        const { imageUrl } = req.body;

        console.log(`📝 Updating photo for student ID: ${id}`);
        console.log(`🖼️  Image URL received: ${imageUrl}`);

        // Validation A: Ensure the ID is a valid 24-character MongoDB ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            error: "Invalid student ID format.",
          });
        }

        // Validation B: Ensure a valid URL string was sent in the body
        if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
          return res.status(400).json({
            error: "Please provide a valid image URL starting with http/https.",
          });
        }

        // Update the student document in the MongoDB collection
        const result = await studentsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { imageUrl: imageUrl } }
        );

        // Check if the student actually exists in the database
        if (result.matchedCount === 0) {
          return res.status(404).json({
            error: `Student with ID ${id} was not found.`,
          });
        }

        // Send back a success response
        res.json({
          message: "Student photo updated successfully!",
          imageUrl: imageUrl,
        });
      } catch (error) {
        console.error("❌ Photo update error:", error);
        res.status(500).json({
          error: "Failed to save photo URL to the database.",
        });
      }
    });

    // ----------------------------------------------------
    // 404 FALLBACK HANDLER
    // Purpose: Returns friendly JSON instead of ugly HTML if a route is not found
    // ----------------------------------------------------
    app.use((req, res) => {
      res.status(404).json({
        error: `Route not found: ${req.method} ${req.originalUrl}. Check your endpoint and HTTP method!`,
      });
    });

    // Start listening for incoming requests
    const PORT = process.env.PORT || 3002;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server is listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start the server:", error);
    process.exit(1);
  }
}

startServer();