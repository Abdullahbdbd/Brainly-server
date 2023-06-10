const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nmjlal4.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

     
    const schoolCollection = client.db("summerDb").collection("school")
    const bookedCollection = client.db("summerDb").collection( "booked")
    const usersCollection = client.db("summerDb").collection( "users")


    // Users Collection API

    app.get('/users', async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    })

    app.put('/users/:email', async (req, res) => {
        const email = req.params.email
        const user = req.body
        const query = { email: email }
        const options = { upsert: true }
        const updateDoc = {
          $set: user,
        }
        const result = await usersCollection.updateOne(query, updateDoc, options)
        console.log(result)
        res.send(result)
      })

      app.patch('/users/admin/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                role: 'admin'
            }
        }
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result)
    })



    // School Collection API

    app.get('/school', async(req, res)=>{
        const result = await schoolCollection.find().toArray();
        res.send(result)
    })

    // Booked collection API

    app.get('/booked', async(req, res)=>{
        const email = req.query.email;
        if(!email){
            res.send([]);
        }
        const query = {email: email};
        const result = await bookedCollection.find(query).toArray();
        res.send(result)
    });

    app.post('/booked', async(req, res)=>{
       const item = req.body;
       console.log(item)
       const result = await bookedCollection.insertOne(item)
       res.send(result);
    });

    app.delete('/booked/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookedCollection.deleteOne(query);
        res.send(result);
    })
    



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('student is running')
})


app.listen(port, () => {
    console.log(`student is running on port ${port}`);
})