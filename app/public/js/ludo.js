let socket = io(`${window.location.origin}/ludo`);

const pathParts = window.location.pathname.split('/').filter(Boolean);
const room_code = pathParts[1] || '';
const DEFAULT_USERNAMES = ['Green Warrior', 'Red Fire', 'Blue Fox', 'Yellow Rhino'];
const DISPLAY_NAMES = {};
const PIECES = [];
const colors = ["green","red","blue","yellow"];
let MYROOM = [];
let myid = -1;
let chance = Number(-1);
var PLAYERS = {};
let selectablePieces = [];

var canvas = document.getElementById('theCanvas');
var ctx = canvas.getContext('2d');
canvas.height = 750;
canvas.width = 750;

if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}

const qp = new URLSearchParams(window.location.search);
const tgName = (qp.get('name') || '').trim();
const tgUserId = (qp.get('userId') || '').trim();

let allPiecesePos = {
    0:[{x: 50,y:125},{x:125,y: 50},{x:200,y:125},{x:125,y:200}],
    1:[{x:500,y:125},{x:575,y: 50},{x:650,y:125},{x:575,y:200}],
    2:[{x:500,y:575},{x:575,y:500},{x:650,y:575},{x:575,y:650}],
    3:[{x: 50,y:575},{x:125,y:500},{x:200,y:575},{x:125,y:650}]
}

let homeTilePos = {
    0:{0:{x: 50,y:300},1:{x:300,y:100}},
    1:{0:{x:400,y: 50},1:{x:600,y:300}},
    2:{0:{x:650,y:400},1:{x:400,y:600}},
    3:{0:{x:300,y:650},1:{x:100,y:400}}
}

class Player{
    constructor(id){
        this.id = String(id);
        this.myPieces = new Object();
        for(let i=0;i<4;i++){
            this.myPieces[i] = new Piece(String(i),String(id));
        }
        this.won = parseInt(0);        
    }
    draw(){
        for(let i=0;i<4;i++){
            this.myPieces[i].draw();
        }
    }

    didIwin(){
        if(this.won == 4){
            return 1;
        }else{return 0;}
    }
}

class Piece{
    constructor(i,id){
        this.path = [];
        this.color_id = String(id);
        console.log(this.color_id,typeof(this.color_id));
        this.Pid = String(i);
        this.pos = -1;
        this.x = parseInt(allPiecesePos[this.color_id][this.Pid].x);
        this.y = parseInt(allPiecesePos[this.color_id][this.Pid].y);
        this.image = PIECES[this.color_id];
        switch(id){
            case '0':
                console.log('switch is working');
                for(let i=0;i<4;i++){this.path.push(this.oneStepToRight)}
                this.path.push(this.oneStepTowards45);
                for(let i=0;i<5;i++){this.path.push(this.oneStepToTop)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToRight)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToBottom)}
                this.path.push(this.oneStepTowards315)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToRight)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToBottom)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToLeft)}
                this.path.push(this.oneStepTowards225)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToBottom)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToLeft)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToTop)}
                this.path.push(this.oneStepTowards135)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToLeft)}
                this.path.push(this.oneStepToTop)
                for(let i=0;i<6;i++){this.path.push(this.oneStepToRight)}
                break;
            case '1':
                for(let i=0;i<4;i++){this.path.push(this.oneStepToBottom)}
                this.path.push(this.oneStepTowards315)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToRight)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToBottom)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToLeft)}
                this.path.push(this.oneStepTowards225)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToBottom)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToLeft)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToTop)}
                this.path.push(this.oneStepTowards135)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToLeft)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToTop)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToRight)}
                this.path.push(this.oneStepTowards45);
                for(let i=0;i<5;i++){this.path.push(this.oneStepToTop)}
                this.path.push(this.oneStepToRight)
                for(let i=0;i<6;i++){this.path.push(this.oneStepToBottom)}
                break;
            case '2':
                for(let i=0;i<4;i++){this.path.push(this.oneStepToLeft)}
                this.path.push(this.oneStepTowards225)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToBottom)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToLeft)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToTop)}
                this.path.push(this.oneStepTowards135)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToLeft)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToTop)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToRight)}
                this.path.push(this.oneStepTowards45);
                for(let i=0;i<5;i++){this.path.push(this.oneStepToTop)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToRight)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToBottom)}
                this.path.push(this.oneStepTowards315)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToRight)}
                this.path.push(this.oneStepToBottom)
                for(let i=0;i<6;i++){this.path.push(this.oneStepToLeft)}
                break;
            case '3':
                for(let i=0;i<4;i++){this.path.push(this.oneStepToTop)}
                this.path.push(this.oneStepTowards135)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToLeft)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToTop)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToRight)}
                this.path.push(this.oneStepTowards45);
                for(let i=0;i<5;i++){this.path.push(this.oneStepToTop)}
                for(let i=0;i<2;i++){this.path.push(this.oneStepToRight)}
                for(let i=0;i<5;i++){this.path.push(this.oneStepToBottom)}
                this.path.push(this.oneStepTowards315)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToRight)}
                for(let i=0;i<2;i++)this.path.push(this.oneStepToBottom)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToLeft)}
                this.path.push(this.oneStepTowards225)
                for(let i=0;i<5;i++){this.path.push(this.oneStepToBottom)}
                this.path.push(this.oneStepToLeft)
                for(let i=0;i<6;i++){this.path.push(this.oneStepToTop)}
                break;
        }
    }

    draw(){
        ctx.drawImage(this.image, this.x, this.y, 50, 50);
    }

    update(num){
        if(this.pos != -1 && this.pos+num<=56){

            for(let i=this.pos;i<this.pos+num;i++){
                this.path[i](this.color_id,this.Pid);console.log('hemilo selmon')
            }
            this.pos += num;
            if(this.pos ==56){
                window.PLAYERS[this.color_id].won +=1;
            }

        }else if(num == 6 && this.pos == -1){
            this.x = homeTilePos[this.color_id][0].x
            this.y = homeTilePos[this.color_id][0].y
            this.pos = 0;
        }
    }

    oneStepToRight(id,pid){
        window.PLAYERS[id].myPieces[pid].x += 50;
        console.log('to r',this.x,this.y,typeof(this.x),typeof(this.y));
    }

    oneStepToLeft(id,pid){
        window.PLAYERS[id].myPieces[pid].x -= 50;
        console.log('to l',this.x,this.y,typeof(this.x),typeof(this.y));
    }

    oneStepToTop(id,pid){
        window.PLAYERS[id].myPieces[pid].y -= 50;
        console.log('to t',this.x,this.y,typeof(this.x),typeof(this.y));
    }

    oneStepToBottom(id,pid){
        window.PLAYERS[id].myPieces[pid].y += 50;
        console.log('to b',this.x,this.y,typeof(this.x),typeof(this.y));
    }

    oneStepTowards45(id,pid){
        window.PLAYERS[id].myPieces[pid].x += 50;
        window.PLAYERS[id].myPieces[pid].y -= 50;
        console.log('to 45',this.x,this.y,typeof(this.x),typeof(this.y));
    }

    oneStepTowards135(id,pid){
        window.PLAYERS[id].myPieces[pid].x -= 50;
        window.PLAYERS[id].myPieces[pid].y -= 50;
        console.log('to 135',this.x,this.y,typeof(this.x),typeof(this.y));
    }

    oneStepTowards225(id,pid){
        window.PLAYERS[id].myPieces[pid].x -= 50;
        window.PLAYERS[id].myPieces[pid].y += 50;
        console.log('to 225',this.x,this.y,typeof(this.x),typeof(this.y));
    }

    oneStepTowards315(id,pid){
        window.PLAYERS[id].myPieces[pid].x += 50;
        window.PLAYERS[id].myPieces[pid].y += 50;
        console.log('to 315',this.x,this.y,typeof(this.x),typeof(this.y));
    }

    kill(){
        this.x = allPiecesePos[this.color_id][this.Pid].x;
        this.y = allPiecesePos[this.color_id][this.Pid].y;
        this.pos = -1;  
    }
}

socket.on('connect',function(){
    console.log('You are connected to the server!!');

    socket.emit('fetch',{ room: room_code, name: tgName, userId: tgUserId },function(data,id,names){
        MYROOM = data.sort(function(a, b){return a - b});
        for(let i=0;i<MYROOM.length;i++){MYROOM[i] = +MYROOM[i]}
        myid = id;
        if (names && typeof names === 'object') {
            Object.keys(names).forEach((key) => {
                DISPLAY_NAMES[key] = names[key] || DEFAULT_USERNAMES[Number(key)] || `Player ${key}`;
            });
        }
        console.log('19/6/21 fetched:',MYROOM,myid,chance);
        StartTheGame();
    });

    socket.on('imposter',()=>{window.location.replace("/error-imposter");});

    socket.on('is-it-your-chance',function(data){
        if(data===myid){
            styleButton(1);
            outputMessage({Name:'your',id:data},4)
        }else{
            selectablePieces = [];
            outputMessage({Name:getPlayerName(data)+"'s",id:data},4)
            allPlayerHandler();
        }
        chance = Number(data);
        window.localStorage.setItem('chance',chance.toString());
        updateHudNames();
    });

    socket.on('new-user-joined',function(data){
        MYROOM.push(data.id);
        MYROOM = [...(new Set(MYROOM))];
        MYROOM.sort(function(a, b){return a - b});
        for(let i=0;i<MYROOM.length;i++){MYROOM[i] = +MYROOM[i]}
        if (data.names && typeof data.names === 'object') {
            Object.keys(data.names).forEach((key) => {
                DISPLAY_NAMES[key] = data.names[key] || DEFAULT_USERNAMES[Number(key)] || `Player ${key}`;
            });
        }
        loadNewPiece(data.id);
        outputMessage({Name:getPlayerName(data.id),id:data.id},0);
        updateHudNames();
        //stop timer,and hide modal.
        document.getElementById("myModal-2").style.display = "none";
        let butt = document.getElementById('WAIT');
        butt.disabled = false;
        butt.style.opacity =  1;
        butt.style.cursor = "pointer"
        clearInterval(window.timer);
    });

    socket.on('user-disconnected',function(data){
        outputMessage({Name:getPlayerName(data),id:data},6);
        updateHudNames();
        resumeHandler(data);    
    })

    socket.on('resume',function(data){
        resume(data.id);
        data.id==data.click?outputMessage({id:data.id,msg:`Resumed the game without ${getPlayerName(id)}`},5):outputMessage({id:data.click,msg:`${getPlayerName(data.click)} has resumed the game without ${getPlayerName(data.id)}`},5)
    });

    socket.on('wait',function(data){
        wait();
        outputMessage({id:data.click,msg:`${getPlayerName(data.click)} has decided to wait`},5)
    });

    socket.on('rolled-dice',function(data){
        const rollerName = getPlayerName(data.id);
        outputMessage({Name:rollerName,Num:data.num,id:data.id},1);
    });

    socket.on('Thrown-dice',async function(data){
        console.log(data);
        await PLAYERS[data.id].myPieces[data.pid].update(data.num);
        if(iKill(data.id,data.pid)){
            outputMessage({msg:'Oops got killed',id:data.id},5);
            allPlayerHandler();
        }else{
            allPlayerHandler();
        }
        if(PLAYERS[data.id].didIwin()){
            socket.emit('WON',{
                room: data.room,
                id: data.id,
                player:myid
            });
        }
    });

    socket.on('winner',function(data){
        showModal(data);
    })

});

//To simulate dice
document.querySelector('#randomButt').addEventListener('click',function(event){
    event.preventDefault();
    if(chance !== myid){
        outputMessage({Name:getPlayerName(chance),id:chance},4);
        return;
    }
    console.log('randomButt clicked');
    styleButton(0);
    diceAction();
});


//To know if the client has disconnected with the server
socket.on('disconnect', function(){
    console.log('You are disconnected to the server');
})

//Output the message through DOM manipulation
function outputMessage(anObject,k){
    const statusEl = document.getElementById('status-line');
    if(!statusEl) return;
    let msg = 'Ready';
    if(k===1 && anObject?.Name){
        msg = `${anObject.Name} got ${anObject.Num}`;
        statusEl.textContent = msg;
        setTimeout(() => {
            statusEl.textContent = `Turn: ${getPlayerName(chance)}`;
        }, 2000);
        return;
    }
    else if(k===0 && anObject?.Name){ msg = `${anObject.Name} entered the game`; }
    else if(k===3){ msg = `${anObject}`; }
    else if(k===4 && anObject?.Name){ msg = `It is ${anObject.Name} chance`; }
    else if(k===5 && anObject?.msg){ msg = anObject.msg; }
    else if(k===6 && anObject?.Name){ msg = `${anObject.Name} left the game`; }
    statusEl.textContent = msg;
};

function getPlayerName(id){
    const key = String(id);
    return DISPLAY_NAMES[key] || DEFAULT_USERNAMES[Number(key)] || `Player ${key}`;
}

//button disabling-enabling
function styleButton(k){
    let butt = document.getElementById("randomButt")
    if(k===0){
        butt.disabled = true;
        butt.style.opacity =  0.6;
        butt.style.cursor = "not-allowed"
    }
    else if(k===1){
        butt.disabled = false;
        butt.style.opacity = 1;
        butt.style.cursor = "pointer";
    }
}

//simulates the action of dice and also chance rotation.
function diceAction(){
    socket.emit('roll-dice',{room:room_code,id:myid},function(num){
        console.log('19/6/21 dice rolled, got',num);
        let spirit = [];
        for(let i=0;i<4;i++){
            if(PLAYERS[myid].myPieces[i].pos>-1 && PLAYERS[myid].myPieces[i].pos + num <= 56){
                spirit.push(i);

            }
        }
        selectablePieces = [0,1,2,3].filter((i) => (spirit.includes(i) || num===6) && PLAYERS[myid].myPieces[i].pos + num <= 56);
        allPlayerHandler();
        if(spirit.length!=0 || num==6){
            outputMessage('Click on a piece',3)
            canvas.addEventListener('click',function clickHandler(e){
                console.log('19/6/21 click event litener added to canvas element');
                const rect = e.target.getBoundingClientRect();
                let Xp = ((e.clientX - rect.left) * canvas.width) / rect.width;
                let Yp = ((e.clientY - rect.top) * canvas.height) / rect.height;
                let playerObj = {
                    room: room_code,
                    id: myid,
                    num: num
                }
                let alert1 = true;

                for(let i=0;i<4;i++){
                    if(Xp-PLAYERS[myid].myPieces[i].x<45 && Xp-PLAYERS[myid].myPieces[i].x>0 && Yp-PLAYERS[myid].myPieces[i].y<45 && Yp-PLAYERS[myid].myPieces[i].y>0){
                        console.log(i,'okokokok');
                        if((spirit.includes(i) || num==6) && PLAYERS[myid].myPieces[i].pos+num <=56){
                            playerObj['pid'] = i;
                            console.log(playerObj);
                            socket.emit('random',playerObj, function(data){
                                styleButton(0);
                                selectablePieces = [];
                                allPlayerHandler();
                                console.log('random acknowledged');
                                socket.emit('chance',{room: room_code, nxt_id: chanceRotation(myid,data)});
                            });
                            canvas.removeEventListener('click',clickHandler);
                            return 0;
                        }else{
                            alert('Please click on a valid Piece.');
                            alert1 = false;
                            break;
                        }
                    }
        
                }
                if(alert1){alert('You need to click on a piece of your color');}
            })
        }else{
            selectablePieces = [];
            allPlayerHandler();
            socket.emit('chance',{room: room_code, nxt_id: chanceRotation(myid,num)});console.log('19/6/21 next chance');
        }
    })
}

//Initialise the game with the one who created the room.
function StartTheGame(){
    MYROOM.forEach(function(numb){
        numb==myid?outputMessage({Name:'You',id:numb},0):outputMessage({Name:getPlayerName(numb),id:numb},0)
    });
    document.getElementById('my-name').innerHTML = `✨ ${getPlayerName(myid)}`;console.log(myid); //my-name
    updateHudNames();
    if(MYROOM.length === 1){
        styleButton(1);
        chance = Number(myid);
    }else{
        styleButton(0);
    }
    loadAllPieces();
}

function updateHudNames() {
    const meName = getPlayerName(myid);
    const currentTurn = chance > -1 ? getPlayerName(chance) : (MYROOM[0] !== undefined ? getPlayerName(MYROOM[0]) : 'Player');
    const zoneDefaults = ['Green', 'Red', 'Blue', 'Yellow'];
    for (let i = 0; i < 4; i += 1) {
        const label = document.getElementById(`zone-name-${i}`);
        if (!label) continue;
        label.textContent = MYROOM.includes(i) ? getPlayerName(i) : zoneDefaults[i];
    }

    const turnLeft = document.getElementById('turn-left');
    const turnRight = document.getElementById('turn-right');

    if (turnLeft) turnLeft.textContent = meName;
    if (turnRight) turnRight.textContent = currentTurn;
}

//Load all the images of the pieces
function loadAllPieces(){
    let cnt = 0;
    for(let i=0;i<colors.length;i++){
        let img = new Image();
        img.src = "/images/pieces/"+colors[i]+".png";
        img.onload = ()=>{
            ++cnt;
            if(cnt >= colors.length){
                //all images are loaded
                for(let j=0;j<MYROOM.length;j++){
                    PLAYERS[MYROOM[j]] = new Player(MYROOM[j]);
                }
                if(window.localStorage.getItem('room')==room_code){
                    console.log('19/6/21 yes my localStorage is for this room');
                    if(window.localStorage.getItem('started')=='true'){
                        console.log('19/6/21 yes i from this room');
                        chance = Number(window.localStorage.getItem('chance'));
                        let positions = JSON.parse(window.localStorage.getItem('positions'));
                        let win = JSON.parse(window.localStorage.getItem('win'));
                        for(let i=0;i<MYROOM.length;i++){
                            PLAYERS[MYROOM[i]].win = Number(MYROOM[i]);
                            for(let j=0;j<4;j++){
                                console.log('19/6/21 yes room==room_code && started==true:i,j:',i,j);
                                PLAYERS[MYROOM[i]].myPieces[j].x = Number(positions[MYROOM[i]][j].x);
                                PLAYERS[MYROOM[i]].myPieces[j].y = Number(positions[MYROOM[i]][j].y);
                                PLAYERS[MYROOM[i]].myPieces[j].pos = Number(positions[MYROOM[i]][j].pos);
                            }
                        }
                        allPlayerHandler();
                    }else{allPlayerHandler();}
                }else{
                    window.localStorage.clear();
                    window.localStorage.setItem('room', room_code);
                    allPlayerHandler();
                }
            }
        }
        PIECES.push(img);
    }
}

//rotate chance, required for the game
function chanceRotation(id,num){
    if(num==6){
        console.log('19/6/21 nxt 0 chance(num==6)',id);
        return id
    }
    else{
        let c = MYROOM[chance+1]
        if(c){
            console.log('19/6/21 nxt 1 chance(MYROOM[chance+1])',c,'\nMYROOM',MYROOM,'\nPrevious chance',chance);
            return c;
        }else{
            console.log('19/6/21 nxt 2 chance(MYROOM[0])',MYROOM[0],'\nMYROOM',MYROOM,'\nPrevious chance',chance,'c:',c,'chance+1',chance+1,'MYROOM[chance+1]',MYROOM[chance+1]);
            return MYROOM[0];
        }
    }
}

//draws 4 x 4 = 16 pieces per call
function allPlayerHandler(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for(let i=0;i<Object.keys(PLAYERS).length;i++){
        PLAYERS[MYROOM[i]].draw();
    }
    drawSelectableHints();
    //Store chance, all 16 pos
    //a boolean, for if this function has been called atleast once
    let positions = {}
    let win = {}
    for(let i=0;i<MYROOM.length;i++){
        positions[MYROOM[i]] = {}
        win[MYROOM[i]] = PLAYERS[MYROOM[i]].win
        for(let j=0;j<4;j++){
            positions[MYROOM[i]][j] = {
                x:PLAYERS[MYROOM[i]].myPieces[j].x,
                y:PLAYERS[MYROOM[i]].myPieces[j].y,
                pos:PLAYERS[MYROOM[i]].myPieces[j].pos
            };
        }
    }
    window.localStorage.setItem('started','true');
    window.localStorage.setItem('chance',chance.toString());
    window.localStorage.setItem('positions',JSON.stringify(positions));
    window.localStorage.setItem('win',JSON.stringify(win));
}

function drawSelectableHints(){
    if(!Array.isArray(selectablePieces) || selectablePieces.length===0) return;
    if(myid < 0 || !PLAYERS[myid]) return;

    selectablePieces.forEach((pid)=>{
        const piece = PLAYERS[myid].myPieces[pid];
        if(!piece) return;
        const cx = piece.x + 25;
        const cy = piece.y + 25;

        ctx.beginPath();
        ctx.arc(cx, cy, 31, 0, 2*Math.PI);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 36, 0, 2*Math.PI);
        ctx.strokeStyle = 'rgba(0,162,255,0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

//Load a new Player instance
function loadNewPiece(id){
    PLAYERS[id] = new Player(id);
    if(window.localStorage.getItem('room') == room_code){
        console.log('19/6/21 yes I\'m from our room');
        if(window.localStorage.getItem('started')){
            //chance = Number(window.localStorage.getItem('chance'));
            console.log('19/6/21 yes i have already started the game');
            let positions = JSON.parse(window.localStorage.getItem('positions'));
            let win = JSON.parse(window.localStorage.getItem('win'));
            if(positions[id]){
                console.log(`yes I have some data for user of id: ${id} in my local storage\nIt is ${positions[id]}`);
                PLAYERS[id].win = Number(win[id]);
                for(let j=0;j<4;j++){
                    console.log(`19/6/21 for ${id},${j}\nx:${Number(positions[id][j].x)}\ny:${Number(positions[id][j].y)}\npos:${Number(positions[id][j].pos)}`);
                    PLAYERS[id].myPieces[j].x = Number(positions[id][j].x);
                    PLAYERS[id].myPieces[j].y = Number(positions[id][j].y);
                    PLAYERS[id].myPieces[j].pos = Number(positions[id][j].pos);
                }
            }
        }
    }
    allPlayerHandler();
}

function iKill(id,pid){
    let boss = PLAYERS[id].myPieces[pid];
    for(let i=0;i<MYROOM.length;i++){
        for(let j=0;j<4;j++){
            if(MYROOM[i]!=id && boss.x == PLAYERS[MYROOM[i]].myPieces[j].x && boss.y == PLAYERS[MYROOM[i]].myPieces[j].y){
                if(!inAhomeTile(id,pid)){
                    PLAYERS[MYROOM[i]].myPieces[j].kill();
                    return 1;
                }
            }
        }
    }
    return 0;
}

function inAhomeTile(id,pid){
    for(let i=0;i<4;i++){
        if((PLAYERS[id].myPieces[pid].x == homeTilePos[i][0].x && PLAYERS[id].myPieces[pid].y == homeTilePos[i][0].y) || (PLAYERS[id].myPieces[pid].x == homeTilePos[i][1].x && PLAYERS[id].myPieces[pid].y == homeTilePos[i][1].y)){
            return true;
        }
    }

    return false;
}

function showModal(id){
    window.localStorage.clear();
    document.getElementById("myModal-1").style.display = "block";
    document.getElementById("win-win").innerHTML = `The winner is ${getPlayerName(id)}`

}

async function copyhandler() {
    var copyText = document.getElementById("copy").innerHTML;
    await navigator.clipboard.writeText(copyText);
    
    var tooltip = document.getElementById("myTooltip");
    tooltip.innerHTML = "Copied!!";
}
  
function outFunc() {
    var tooltip = document.getElementById("myTooltip");
    tooltip.innerHTML = "Copy to clipboard";
}

async function copyhandlerLink() {
    var copyText = window.location.href;
    await navigator.clipboard.writeText(copyText);
    
    var tooltip = document.getElementById("myTooltipLink");
    tooltip.innerHTML = "Copied!!";
}
  
function outFuncLink() {
    var tooltip = document.getElementById("myTooltipLink");
    tooltip.innerHTML = "Copy room link to clipboard";
}

function resumeHandler(id){
    document.getElementById("myModal-2").style.display = "block";
    //who left+timer!
    let theOneWhoLeft = document.getElementById('theOneWhoLeft');
    let seconds = document.getElementById('seconds');
    let i = 10
    theOneWhoLeft.innerHTML = getPlayerName(id)
    theOneWhoLeft.style.textShadow = `0 0 4px ${colors[id]}`;
    document.getElementById('RESUME').onclick = function(){
        resume(id);
        socket.emit('resume',{
            room:room_code,
            id:id,
            click:myid
        },function(){
            outputMessage({id:myid,msg:`You have resumed the game without ${getPlayerName(id)}`},5);
            if(chance==id){
                socket.emit('chance',{room: room_code, nxt_id: chanceRotation(id,0)});
            }
        });

    };
    document.getElementById('WAIT').onclick = function(){
        wait();
        socket.emit('wait',{
            room:room_code,
            click:myid
        },function(){
            outputMessage({id:myid,msg:`You have decided to wait`},5)
        });

    };
    window.timer = setInterval(function(){
        i-=1;
        seconds.innerHTML = ` in ${i}`;
        if(i==0){
            resume(id);
            socket.emit('resume',{
                room:room_code,
                id:id,
                click:id
            },function(){
                outputMessage({id:id,msg:`Resumed the game without ${getPlayerName(id)}`},5);
                if(chance==id){
                    socket.emit('chance',{room: room_code, nxt_id: chanceRotation(id,0)});
                }
            });

        }
    }, 1000)
}

function resume(id){
    document.getElementById("myModal-2").style.display = "none";
    clearInterval(timer);
    MYROOM.splice(id,1);
    delete PLAYERS[id];
    allPlayerHandler();
}

function wait(){
    clearInterval(timer);
    document.getElementById('seconds').innerHTML = '';
    let butt = document.getElementById('WAIT');
    butt.disabled = true;
    butt.style.opacity =  0.6;
    butt.style.cursor = "not-allowed"
}
