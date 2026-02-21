const {join} = require('path')
const views = join(__dirname, '../views');

let {rooms,NumberOfMembers,roomStarted} = require('../models/model')

exports.root = (_req,res)=>{
    res.redirect(301,'/');
}

exports.room = (req,res)=>{
    const roomCode = normalizeRoomCode(req.params.ROOMCODE);
    if(!Object.keys(rooms).includes(roomCode)){
        res.statusCode = 404;
        return res.end('404!:(\nThis is either not a valid Room Code or The room is filled up, Go to home and create a room!');
    }

    if (roomStarted[roomCode]) {
        return res.redirect(302, `/ludo/${roomCode}/game${buildQuery(req.query)}`);
    }

    return res.sendFile('waiting.html', { root: views });
}

exports.game = (req,res)=>{
    const roomCode = normalizeRoomCode(req.params.ROOMCODE);
    if(!Object.keys(rooms).includes(roomCode)){
        res.statusCode = 404;
        return res.end('404!:(\nThis is either not a valid Room Code or The room is filled up, Go to home and create a room!');
    }

    if (!roomStarted[roomCode]) {
        return res.redirect(302, `/ludo/${roomCode}${buildQuery(req.query)}`);
    }

    return res.sendFile('ludo.html', { root: views });
}

function buildQuery(queryObj = {}) {
    const keys = Object.keys(queryObj || {});
    if (!keys.length) return '';
    const qs = new URLSearchParams(queryObj).toString();
    return qs ? `?${qs}` : '';
}

function normalizeRoomCode(rawCode = '') {
    return String(rawCode || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();
}
