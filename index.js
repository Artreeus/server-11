const express = require("express");

const jwt = require("jsonwebtoken");

const cookieParser = require("cookie-parser");

const cors = require("cors");

require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.port || 5000;

// middleware

const logger = (req, res, next) => {
  console.log("log: info", req.method, req.url);
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log('token in the middleware', token);
  // no token available
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

//Must remove "/" from your production URL
app.use(
  cors({
    origin: ["http://localhost:5173", "https://assingment-11-4a72d.web.app/"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// mongo db

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.d84zeas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const serviceCollection = client.db("Cardr").collection("Services");
    const reviewCollection = client.db("Cardr").collection("reviews");
    const bookingCollection = client.db("Cardr").collection("bookings");

    // auth related api
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", logger, async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // Crud operations

    app.get("/Services", async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Bookings

    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);

      console.log("token owner info", req.user);
      // if (req.user.email !== req.query.email) {
      //     return res.status(403).send({ message: 'forbidden access' })
      // }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);

      // Update room availability status in MongoDB
      await serviceCollection.updateOne(
        { _id: new ObjectId(booking.service_id) },
        { $set: { Availability: false } } // Assuming false indicates room is booked
      );

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/Services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        projection: {
          RoomDescription: 1,
          PricePerNight: 1,
          service_id: 1,
          RoomImage: 1,
          RoomSize: 1,
          Availability: { $toString: "$Availability" },
          SpecialOffers: 1,
        },
      };

      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedBooking = req.body;
        const updateDoc = {
          $set: {
            date: updatedBooking.date, // Update the date field with the new date
          },
        };
        const result = await bookingCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Assingment Server is Running");
});

app.listen(port, () => {
  console.log(`Assingment Server is running ${port}`);
});