const {join} = require('path');
const express = require('express');
const {createServer} = require('http');
const socketIO = require('socket.io');
const dotenv = require('dotenv');

const {PORT} = require('./config/config');

const rootRouter = require('./routes/rootRouter')
const ludoRouter = require('./routes/ludoRouter')

let {rooms,NumberOfMembers,win,telegramRoomUsers,roomStarted,waitingMeta} = require('./models/model');

dotenv.config();

const app = express();
const server = createServer(app);
const io = socketIO(server, {
    cors: {
      origin: '*'
    }});
const ROOM_IDLE_MS = Number(process.env.ROOM_IDLE_MS || 300000); // 5 min default
const CLEANUP_INTERVAL_MS = Number(process.env.ROOM_CLEANUP_INTERVAL_MS || 30000);
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS || 60000); // 1 min default
const roomLastActive = {};
const pendingDisconnects = {};

app.use(express.static(join(__dirname, 'public/')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.enable('trust proxy');

//
///sockets
//
let nsp = io.of('/ludo');

nsp.on('connection',(socket)=>{
    console.log('A User has connected to the game');
    socket.on('waiting:join', (data, cb) => {
        try {
            const roomCode = String(data?.room || '').toLowerCase();
            if (!rooms[roomCode]) throw new Error('invalid room');
            touchRoom(roomCode);

            const waitRoom = `wait-${roomCode}`;
            socket.join(waitRoom);
            socket.data.waitRoom = waitRoom;
            socket.data.waitRoomCode = roomCode;

            if (!waitingMeta[roomCode]) {
                waitingMeta[roomCode] = {
                    hostSid: socket.id,
                    sockets: {},
                    players: {}
                };
            }
            waitingMeta[roomCode].sockets[socket.id] = true;
            if (!waitingMeta[roomCode].hostSid) waitingMeta[roomCode].hostSid = socket.id;

            const userId = String(data?.userId || '');
            const fallback = userId ? (telegramRoomUsers[roomCode]?.[userId] || '') : '';
            const providedName = String(data?.name || fallback || '').trim();
            waitingMeta[roomCode].players[socket.id] = providedName || `Player ${Object.keys(waitingMeta[roomCode].players).length + 1}`;

            const count = Object.keys(waitingMeta[roomCode].sockets).length;
            const started = !!roomStarted[roomCode];
            const isHost = waitingMeta[roomCode].hostSid === socket.id;
            const players = Object.values(waitingMeta[roomCode].players);

            nsp.to(waitRoom).emit('waiting:update', { count, started, players });
            cb?.({ ok: true, count, started, isHost, players });

            if (started) {
                nsp.to(waitRoom).emit('waiting:redirect', { to: `/ludo/${roomCode}/game` });
            }
        } catch (err) {
            cb?.({ ok: false, error: err.message });
        }
    });

    socket.on('waiting:start', (data, cb) => {
        try {
            const roomCode = String(data?.room || '').toLowerCase();
            if (!rooms[roomCode]) throw new Error('invalid room');
            touchRoom(roomCode);
            if (!waitingMeta[roomCode]) throw new Error('room not ready');
            if (waitingMeta[roomCode].hostSid !== socket.id) throw new Error('only room creator can start');

            roomStarted[roomCode] = true;
            const waitRoom = `wait-${roomCode}`;
            nsp.to(waitRoom).emit('waiting:update', {
                count: Object.keys(waitingMeta[roomCode].sockets).length,
                started: true,
                players: Object.values(waitingMeta[roomCode].players || {})
            });
            nsp.to(waitRoom).emit('waiting:redirect', { to: `/ludo/${roomCode}/game` });
            cb?.({ ok: true });
        } catch (err) {
            cb?.({ ok: false, error: err.message });
        }
    });

    socket.on('fetch',(data,cb)=>{
        try{
            const payload = typeof data === 'string' ? { room: data } : (data || {});
            const roomCode = payload.room;
            touchRoom(roomCode);
            const reclaimed = reclaimMemberByUserId(socket.id, roomCode, payload);
            if (reclaimed !== -1) {
                socket.join(roomCode);
                cb(Object.keys(rooms[roomCode]), reclaimed, getDisplayNames(roomCode));
                socket.to(roomCode).emit('new-user-joined',{id:reclaimed, names:getDisplayNames(roomCode)});
                return;
            }
            let member_id = generate_member_id(socket.id, roomCode, payload);
            socket.join(roomCode);
            if(member_id !== -1){
                cb(Object.keys(rooms[roomCode]), member_id, getDisplayNames(roomCode));
                socket.to(roomCode).emit('new-user-joined',{id:member_id, names:getDisplayNames(roomCode)});
            }else{
                console.log('There is someone with m_id = -1');
            }
        }
        catch(err){
            if(err.name === 'TypeError'){
                socket.emit('imposter');
            }
            console.log("hello",err,rooms);
        }
    });

    socket.on('roll-dice',(data,cb)=>{
        touchRoom(data.room);
        rooms[data.room][data.id]['num'] = Math.floor((Math.random()*6) + 1);
        data['num'] = rooms[data.room][data.id]['num']
        nsp.to(data.room).emit('rolled-dice',data);
        cb(rooms[data.room][data.id]['num']);
    })

    socket.on('chance',(data)=>{
        touchRoom(data.room);
        nsp.to(data.room).emit('is-it-your-chance',data.nxt_id);
    });

    socket.on('random',(playerObj,cb)=>{
        touchRoom(playerObj.room);
        // playerObj ={
        //     room: room_code,
        //     id: myid,
        //     pid: pid,
        //     num: temp
        // }
        if(playerObj['num'] != rooms[playerObj.room][playerObj.id]['num']){
            console.log('Someone is trying to cheat!');
        }
        playerObj['num'] = rooms[playerObj.room][playerObj.id]['num']
        nsp.to(playerObj.room).emit('Thrown-dice', playerObj);
        cb(playerObj['num']);
    });

    socket.on('WON',(OBJ)=>{
        touchRoom(OBJ.room);
        if(validateWinner(OBJ,socket)){
            deleteRoomState(OBJ.room);
            nsp.to(OBJ.room).emit('winner',OBJ.id);
        }
    });

    socket.on('resume',(data,cb)=>{
        touchRoom(data.room);
        socket.to(data.room).emit('resume',data);
        NumberOfMembers[data.room].members<=2?2:NumberOfMembers[data.room].members -= 1;
        NumberOfMembers[data.room].constant = true;
        cb();
    });

    socket.on('wait',(data,cb)=>{
        touchRoom(data.room);
        socket.to(data.room).emit('wait',data);
        cb();
    });

    socket.on('disconnect',()=>{
        if (socket.data.waitRoomCode && waitingMeta[socket.data.waitRoomCode]) {
            const roomCode = socket.data.waitRoomCode;
            delete waitingMeta[roomCode].sockets[socket.id];
            delete waitingMeta[roomCode].players[socket.id];
            if (waitingMeta[roomCode].hostSid === socket.id) {
                waitingMeta[roomCode].hostSid = Object.keys(waitingMeta[roomCode].sockets)[0] || '';
            }
            if (Object.keys(waitingMeta[roomCode].sockets).length === 0) {
                delete waitingMeta[roomCode];
            } else {
                nsp.to(`wait-${roomCode}`).emit('waiting:update', {
                    count: Object.keys(waitingMeta[roomCode].sockets).length,
                    started: !!roomStarted[roomCode],
                    players: Object.values(waitingMeta[roomCode].players || {})
                });
            }
        }

        let roomKey = findMemberBySocket(socket.id);
        if(roomKey != undefined){
            scheduleMemberDisconnect(roomKey.room, roomKey.key, socket.id, socket);
        }
        console.log('A client just got disconnected');
    });
});


//
///CUSTOM FUNCTIONS
//

//to randomise the color a player can get when he 'fetch'es.
function generate_member_id(s_id,rc,payload={}){
    if (!rooms[rc]) return -1;
    let m_id = Math.floor(Math.random()*4);
    let m_r = Object.keys(rooms[rc]);
    if(m_r.length < 4){
        if(m_r.includes(m_id.toString())){
            return generate_member_id(s_id,rc,payload)
        }else{
            const userId = String(payload.userId || '');
            const fallbackName = userId && telegramRoomUsers[rc]?.[userId] ? telegramRoomUsers[rc][userId] : '';
            const name = String(payload.name || fallbackName || '').slice(0, 24);
            rooms[rc][m_id] = {sid:s_id,num:0,userId,name};
            clearPendingDisconnect(rc, m_id);
            return m_id;
        }
    } else{
        return -1;
    }
}

//find member by socket id
function findMemberBySocket(id){
    for(var roomcd in rooms){
        if(rooms.hasOwnProperty(roomcd)){
            const ky = Object.keys(rooms[roomcd]).find( key => rooms[roomcd][key]['sid'] == id);
            if(typeof(ky) === 'string'){
                return {key:ky,room:roomcd};
            }
        }
    }
    
}

function reclaimMemberByUserId(socketId, roomCode, payload = {}) {
    if (!rooms[roomCode]) return -1;
    const userId = String(payload.userId || '');
    if (!userId) return -1;
    const existingKey = Object.keys(rooms[roomCode]).find((key) => String(rooms[roomCode][key]?.userId || '') === userId);
    if (existingKey === undefined) return -1;
    rooms[roomCode][existingKey].sid = socketId;
    if (payload.name) rooms[roomCode][existingKey].name = String(payload.name).slice(0, 24);
    clearPendingDisconnect(roomCode, existingKey);
    return Number(existingKey);
}

function pendingKey(roomCode, memberKey) {
    return `${roomCode}:${memberKey}`;
}

function clearPendingDisconnect(roomCode, memberKey) {
    const key = pendingKey(roomCode, memberKey);
    if (pendingDisconnects[key]) {
        clearTimeout(pendingDisconnects[key]);
        delete pendingDisconnects[key];
    }
}

function scheduleMemberDisconnect(roomCode, memberKey, socketId, socket) {
    clearPendingDisconnect(roomCode, memberKey);
    const key = pendingKey(roomCode, memberKey);
    pendingDisconnects[key] = setTimeout(() => {
        if (!rooms[roomCode] || !rooms[roomCode][memberKey]) {
            delete pendingDisconnects[key];
            return;
        }
        // If the user already reconnected with a new socket, do not remove.
        if (rooms[roomCode][memberKey].sid !== socketId) {
            delete pendingDisconnects[key];
            return;
        }
        delete rooms[roomCode][memberKey];
        delete pendingDisconnects[key];
        if (socket) {
            socket.to(roomCode).emit('user-disconnected', memberKey);
        } else {
            nsp.to(roomCode).emit('user-disconnected', memberKey);
        }
    }, DISCONNECT_GRACE_MS);
}

//to validate a winner, by comparing the data provided by all 4
function validateWinner(OBJ,socket){
    win[OBJ.room][OBJ.player] = {o:OBJ,s:socket.id};
    if(()=>{
        if(Object.keys(win[OBJ.room]).length == 4){
            for(let i=0;i<4;i++){
                if(win[OBJ.room][String(i)]['s']==rooms[OBJ.room][String(i)]['sid']){
                    continue;
                }else{return false}
            }
            return true;
        }else{return false;}
    }){
        for(let i=0;i<3;i++){
            if(win[OBJ.room][String(i)]['o'].id == win[OBJ.room][String(i+1)]['o'].id){
                continue;
            }else{return false}
        }
        return true;
    }else{return false;}
    
}

//
///Routes management
//
app.use('/', rootRouter);
app.use('/ludo', ludoRouter);
app.post('/api/telegram/room', (req, res) => {
    const expected = String(process.env.INTERNAL_API_TOKEN || '');
    const received = String(req.headers['x-internal-token'] || '');
    if (!expected || received !== expected) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const randomPath = createUniqueRoomCode();
    rooms[randomPath] = {};
    win[randomPath] = {};
    NumberOfMembers[randomPath] = { constant: false, members: 4 };
    telegramRoomUsers[randomPath] = {};
    roomStarted[randomPath] = false;
    touchRoom(randomPath);

    const userId = String(req.body?.userId || '');
    const name = String(req.body?.name || '').trim();
    if (userId && name) {
        telegramRoomUsers[randomPath][userId] = name.slice(0, 24);
    }

    return res.status(201).json({
        ok: true,
        roomCode: randomPath,
        roomUrl: `${req.protocol}://${req.get('host')}/ludo/${randomPath}`
    });
});
app.post('/api/telegram/join', (req, res) => {
    const expected = String(process.env.INTERNAL_API_TOKEN || '');
    const received = String(req.headers['x-internal-token'] || '');
    if (!expected || received !== expected) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const roomCode = String(req.body?.roomCode || '').toLowerCase();
    const userId = String(req.body?.userId || '');
    const name = String(req.body?.name || '').trim();

    if (!rooms[roomCode]) return res.status(404).json({ ok: false, error: 'room not found' });
    if (!userId || !name) return res.status(400).json({ ok: false, error: 'userId and name required' });

    telegramRoomUsers[roomCode] = telegramRoomUsers[roomCode] || {};
    telegramRoomUsers[roomCode][userId] = name.slice(0, 24);
    touchRoom(roomCode);
    return res.json({ ok: true, roomCode });
});
app.use(function (req, res) {
    res.statusCode = 404;
    res.end('404!');
});

server.listen(PORT,()=>{
    console.log(`The server has started working on http://localhost:${PORT}`);
});

function createUniqueRoomCode() {
    let code = Math.random().toString(36).substr(2, 6);
    while (Object.keys(rooms).includes(code)) {
        code = Math.random().toString(36).substr(2, 6);
    }
    return code;
}

function getDisplayNames(roomCode) {
    const out = {};
    if (!rooms[roomCode]) return out;
    Object.keys(rooms[roomCode]).forEach((id) => {
        out[id] = rooms[roomCode][id]?.name || '';
    });
    return out;
}

function touchRoom(roomCode) {
    if (!roomCode) return;
    roomLastActive[roomCode] = Date.now();
}

function hasActivePlayers(roomCode) {
    const inGame = rooms[roomCode] && Object.keys(rooms[roomCode]).length > 0;
    const inWaiting = waitingMeta[roomCode] && Object.keys(waitingMeta[roomCode].sockets || {}).length > 0;
    return !!(inGame || inWaiting);
}

function deleteRoomState(roomCode) {
    delete win[roomCode];
    delete NumberOfMembers[roomCode];
    delete telegramRoomUsers[roomCode];
    delete roomStarted[roomCode];
    delete waitingMeta[roomCode];
    delete rooms[roomCode];
    delete roomLastActive[roomCode];
}

setInterval(() => {
    const now = Date.now();
    Object.keys(rooms).forEach((roomCode) => {
        if (!roomLastActive[roomCode]) {
            roomLastActive[roomCode] = now;
            return;
        }
        if (hasActivePlayers(roomCode)) {
            return;
        }
        if (now - roomLastActive[roomCode] >= ROOM_IDLE_MS) {
            deleteRoomState(roomCode);
            console.log(`Deleted idle room ${roomCode}`);
        }
    });
}, CLEANUP_INTERVAL_MS);
