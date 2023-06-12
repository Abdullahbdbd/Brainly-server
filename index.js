const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


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
    // await client.connect();

     
    const schoolCollection = client.db("summerDb").collection("school")
    const bookedCollection = client.db("summerDb").collection( "booked")
    const usersCollection = client.db("summerDb").collection( "users")
    const paymentCollection = client.db("summerDb").collection( "payment")


    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
        res.send({ token })
    })


    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        if (user?.role !== 'admin') {
            return res.status(403).send({ error: true, message: 'Forbidden message' });
        }
        next();
        
    }

    const verifyInstructor = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        if (user?.role !== 'instructor') {
            return res.status(403).send({ error: true, message: 'Forbidden message' });
        }
        next();
    }


    // Users Collection API

    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
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
        res.send(result)
      })


      app.get('/users/admin/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;

        if (req.decoded.email !== email) {
            res.send({ admin: false })
        }

        const query = { email: email }
        const user = await usersCollection.findOne(query);
        const result = { admin: user?.role === 'admin' }
        res.send(result);
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


    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;

        if (req.decoded.email !== email) {
            res.send({ instructor: false })
        }

        const query = { email: email }
        const user = await usersCollection.findOne(query);
        const result = { instructor: user?.role === 'instructor' }
        res.send(result);
    })

    
      app.patch('/users/instructor/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                role: 'instructor'
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


    app.post('/school', verifyJWT, verifyInstructor, async (req, res) => {
        const newItem = req.body;
        const result = await schoolCollection.insertOne(newItem)
        res.send(result)
    })


    app.delete('/school/:id', verifyJWT, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await schoolCollection.deleteOne(query);
        res.send(result);
    })

    app.get('/school/:email', async (req, res) => {
        const email = req.params.email
        const query = { 'email': email }
        const result = await schoolCollection.find(query).toArray()
        res.send(result)
      })

    // Booked collection API

    app.get('/booked', verifyJWT, async(req, res)=>{
        const email = req.query.email;
        if(!email){
            res.send([]);
        }

        const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access' });
            }

        const query = {email: email};
        const result = await bookedCollection.find(query).toArray();
        res.send(result)
    });

    app.post('/booked', async(req, res)=>{
       const item = req.body;
       const result = await bookedCollection.insertOne(item)
       res.send(result);
    });

    app.delete('/booked/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookedCollection.deleteOne(query);
        res.send(result);
    })


    // payment

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
        });
        res.send({
            clientSecret: paymentIntent.client_secret
        })
    })
    


    app.post('/payments', verifyJWT, async (req, res) => {
        const payment = req.body;
        const insertResult = await paymentCollection.insertOne(payment);

        const query = { _id: { $in: payment.selectedClassItems.map(id => new ObjectId(id)) } }
        const deleteResult = await bookedCollection.deleteMany(query)

        res.send({ insertResult, deleteResult })
    })

    



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
   
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('student is running')
})


app.listen(port, () => {
    console.log(`student is running on port ${port}`);
})