const path = require('path');
const http = require('http');
const express = require('express');
const socketio= require('socket.io');
const formatMessage = require('./utils/messages');
const {getMongoId,userJoin,getCurrentUser,userLeave,getRoomUsers,}=require('./utils/users');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const User = require('./utils/mongoUsers')
const Room = require('./utils/mongoRooms')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET='asadcfkjhoiuiblew@nlkvdjnls^kjfbdcls$lifkebcps#jklnbfp;s*jbldvcsba@'


mongoose.set('strictQuery', true)
mongoose.connect('mongodb://127.0.0.1:27017/chat-app-db'),{
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
}

const app = express();
const server = http.createServer(app);
const io = socketio(server);
app.use('/',express.static(path.join(__dirname, "renderer")));
app.use(bodyParser.json())


//create room
app.post('/api/create-room', async (req, res) => {
    const getMongoId = async (username) => {
        const user = await User.findOne
        ({username}).lean()
        return user._id
    }
    const {roomName, roomPassword: plainTextPassword, username} = req.body
//roomName and roomPassword constraints and error handling
    if (!roomName || typeof roomName !== 'string'){
        return res.json({status:'error', error:'Invalid Room Name'})
    }

    if (!plainTextPassword || typeof plainTextPassword !== 'string'){
        return res.json({status:'error', error:'Invalid Password'})
    }

    if (plainTextPassword.length < 6){
        return res.json({status: 'error', error: 'Password too small. Should be atleast 6 characters'
        })
    }

    const roomPassword = await bcrypt.hash(plainTextPassword, 10)
    try{
        const response = await Room.create({
            roomName,
            roomPassword,
            $push: {users:[getMongoId(username)]}
        })
        console.log("Room Created Successfully",response)
    }catch(error){
        if (error.code === 11000){
            //duplicate key
            return res.json({status:'error',error:'Room Name already in use'})
        }
        throw error
    
        return res.json({status:'error'})
    }
    res.json({status:'ok'})
})

//join room
app.post('/api/join-room', async (req, res) => {
    const {roomName, roomPassword, username} = req.body
    const room = await Room.findOne({roomName}).lean()
    console.log(room)

    if (!room) {
        return res.json({ status: 'error', error: 'Invalid Room Name/Password' })
    }
    if (await bcrypt.compare(roomPassword, room.roomPassword)) {
        // the roomName, roomPassword combination is successful
        const token=jwt.sign(
            {
                id: room._id,
                roomName: room.roomName
            },
            JWT_SECRET
        )
        const roomName=room.roomName
        //array of users in the room
        return res.json({ status: 'ok', data: token, roomName})
    }
    res.json({ status: 'error', error: 'Invalid Room Name/Password' })
})

//change password
app.post('/api/change-password', async (req, res) => {
    const {token, newPassword: plainTextPassword} = req.body

    if (!plainTextPassword ||typeof plainTextPassword !== 'string'){
        return res.json({status:'error', error:'Invalid password'})
    }

    if (plainTextPassword.length < 6){
        return res.json({status: 'error', error: 'Password too small. Should be atleast 6 characters'
        })
    }

    try{
        const user = jwt.verify(token, JWT_SECRET)
        const _id = user.id

        const password = await bcrypt.hash(plainTextPassword, 10)
        await User.updateOne(
            {_id}, 
            {
                $set: {password}
            }  
        )
        res.json({status: 'ok'})
    }catch(error){
        console.log(error)
        res.json({status: 'error', error: 'STOP ERROR'})
    }
    
})


//login
app.post('/api/login', async (req, res) => {
	const { username, password } = req.body
	const user = await User.findOne({ username }).lean()

	if (!user) {
		return res.json({ status: 'error', error: 'Invalid username/password' })
	}

	if (await bcrypt.compare(password, user.password)) {
		// the username, password combination is successful

		const token = jwt.sign(
			{
				id: user._id,
				username: user.username
			},
			JWT_SECRET
		)
        const username=user.username

        return res.json({ status: 'ok', data: token, username })    
	}

	res.json({ status: 'error', error: 'Invalid username/password' })
})


//register
app.post('/api/register', async (req, res) =>{
    const {username, password: plainTextPassword} = req.body
//USername and Password constraints and error handling
    if (!username || typeof username !== 'string'){
        return res.json({status:'error', error:'Invalid username'})
    }

    if (!plainTextPassword || typeof plainTextPassword !== 'string'){
        return res.json({status:'error', error:'Invalid password'})
    }

    if (plainTextPassword.length < 6){
        return res.json({status: 'error', error: 'Password too small. Should be atleast 6 characters'
        })
    }

    const password = await bcrypt.hash(plainTextPassword, 10)

    try{
        const response = await User.create({
            username,
            password
        })
        console.log("User Created Successfully",response)
    }catch(error){
        if (error.code === 11000){
            //duplicate key
            return res.json({status:'error',error:'Username already in use'})
        }
        throw error
    
        return res.json({status:'error'})
    }
    res.json({status:'ok'})
})


const botName='ChatCord Bot';

//Run when client connects\
io.on('connection', socket => {
    socket.on('joinRoom',({username,room})=>{
        recentRooms=[]; //recent rooms array
        const user=userJoin(socket.id,username,room);
        socket.join(user.room);

    //Welcome current user
    socket.emit('message', formatMessage(botName,'Welcome to the Chat!'));

    //Broadcast when a user connects
    socket.broadcast.to(user.room)
    .emit('message', formatMessage(botName,`${user.username} has joined the chat`));
        
    //Send users and room info
    io.to(user.room).emit('roomUsers',{
        room: user.room,
        users: getRoomUsers(user.room)
    })
    });

    //Listen for chatMessage
    socket.on('chatMessage', msg =>{
        const user=getCurrentUser(socket.id);
        io.to(user.room)
        .emit('message', formatMessage(user.username,msg));
    })
  //Runs when client disconnects
    socket.on('disconnect', () => {
        const user= userLeave(socket.id);

        if(user){
        io.to(user.room)
        .emit('message', formatMessage(botName,`${user.username} has left the chat`));
        };

        //Send users and room info
        io.to(user.room).emit('roomUsers',{
        room: user.room,
        users: getRoomUsers(user.room)
    })
    });
})

const PORT= 3000||process.env.PORT;

server.listen(PORT,()=>console.log(`Server started on port ${PORT}`));