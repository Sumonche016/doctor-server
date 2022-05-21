const express = require('express')
const app = express()
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config()
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.icohx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const verifyJwt = (req, res, next) => {
    const authHeaders = req.headers.authorization;
    if (!authHeaders) {
        return res.status(401).send({ messege: 'unauthorized' })
    }
    const token = authHeaders.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {

        if (err) {
            return res.status(403).send({ messege: 'forbidden access' })

        }
        req.decoded = decoded
        next()
    })

}
async function run() {
    try {
        await client.connect()
        const serviceCollection = client.db('doctors-portal').collection('services')
        const bookingCollection = client.db('doctors-portal').collection('booking')
        const userCollection = client.db('doctors-portal').collection('users')
        app.get('/services', async (req, res) => {
            const query = {}
            const cursor = serviceCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;
            // 1. get all service 
            const services = await serviceCollection.find().toArray();
            //  2. get the booking of the day 
            const query = { date: date }
            const booking = await bookingCollection.find(query).toArray();
            // 3 : foe each services . find the booking of the service
            services.forEach(service => {
                const serviceBooking = booking.filter(b => b.treatment == service.name)
                //  selects the solots for the service
                const bookingStots = serviceBooking.map(book => book.slots)
                const avialable = service.slots.filter(slots => !bookingStots.includes(slots))
                service.slots = avialable
            })

            // for dahsboard 
            app.get('/booking', verifyJwt, async (req, res) => {
                const patient = req.query.patient;
                const decodedEmail = req.decoded.email;
                if (decodedEmail) {
                    const query = { patient: patient }
                    const booking = await bookingCollection.find(query).toArray();
                    return res.send(booking)
                } else {
                    return res.status(403).send({ messege: 'forbidden access' })

                }

            })

            res.send(services);
        })


        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exits = await bookingCollection.findOne(query)
            if (exits) {
                return res.send({ sucess: false, booking: exits })
            }
            const result = await bookingCollection.insertOne(booking)
            return res.send({ sucess: true, result })
        })


        app.get('/user', verifyJwt, async (req, res) => {
            const user = await userCollection.find().toArray()
            res.send(user)
        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ result, token })
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })


        app.put('/user/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount?.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

        })

    }
    finally {

    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello World! from doctorportal')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})