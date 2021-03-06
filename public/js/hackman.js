// jshist esversion: 6
let gameBoardWidth = 27;
let gameBoardHeight = 27;
let gameCellWidth;
let gameCellHeight;

var canvas;
var ctx;

var bricksImg;
var smileFace;
var tongueFace;
var angryFace;
var irkFace;
var devilFace;
var deadFace;
var ghost;

var gameBoardMap;
var donutsRemaining = Infinity;
var maximumDonuts = 0;
var swipeAnimation = 0;
let paused = true;

const directions = [
    {x:1, y:0, index:0}, 
    {x:0, y:1, index:1}, 
    {x:-1, y:0, index:2}, 
    {x:0, y:-1, index:3}
]
const noDirection = {x: 0, y: 0, index: -1};

class mapLocation extends GridNode{
    constructor(char, x, y) {
        super(x, y);
        if (char === "*" || char === "X" || char === "x") 
            this.obstruction = "wall";

        else if (char === "m") {
            monsters.push(new Monster(x, y, "irk"));
            char = ' ';
        }
        else if (char === "M") {
            monsters.push(new Monster(x, y, "angry"));
            char = ' ';
        }
        else if (char === "T") {
            monsters.push(new Monster(x, y, "turd"));
            char = ' ';
        }
        else if (char === "d") {
            monsters.push(new Monster(x, y, "devil"));
            char = ' ';
        }
        else if (char === "D") {
            monsters.push(new Monster(x, y, "Devil"));
            char = ' ';
        }
        else if (char === "+") {
            let newDonut = new PowerUp(x, y, "donut");
            donuts.push (newDonut);
            this.powerUp = newDonut;
        }
        else if (char === "|") {
            let newCarrot = new PowerUp(x, y, "carrot");
            powerUps.push (newCarrot);
            this.powerUp = newCarrot;
        }
        else if (char === "H") {
            player.locate(x, y);
        }
        this.terrain = char;
    }
    isWall(player = false) {
        if (player) 
            return !this.passableByPlayer
        else 
            return !this.passable
    }
    get passable() {
        return !this.obstruction;
    }
    get passableByPlayer() {
        // player should be free to run right into monsters
        // what fun is it otherwise?
        return this.obstruction
        ? this.obstruction.type === "monster" || this.obstruction.type === "escape"
        : true;
    }
}

class PowerUp {
    constructor(x, y, type = "donut") {
        this.x = x;
        this.y = y;
        this.type = type;
        if (type === "donut") {
            this.char = "+";
            donutsRemaining ++;
        }
        else if (type === "carrot") {
            this.char = "|";
            this.img = carrotImg;
        }
        this.exists = true;
    }
    eat() {
        if (this.exists) {
            this.exists = false;
            gameBoardMap.grid[this.y][this.x].terrain = " ";
            if (this.type === "donut") {
                donutsRemaining --;
                console.log('ate a donut');
                if (player.img === smileFace) {
                    player.img = tongueFace;
                    clearInterval(player.facetimeout);
                    player.facetimeout = setTimeout(() => {
                        player.resetFace()
                    }, 100)
                }
            }
            else if (this.type === "carrot") {
                player.invincible = true;
                player.img = starEyes;
                // reset monsters so they can run away
                monsters.forEach(monster => {
                    monster.moveOptions = 0;
                })
                player.invincible += 100;
            }
        }
    }
    respawn() {
        if (!this.exists) {
            gameBoardMap.grid[this.y][this.x].terrain = this.char;
            if (this.type === "donut") donutsRemaining ++;
            this.exists = true;
        }
    }
}
let donuts = [];
let powerUps = [];

class Player {
    constructor() {
        this.x = 1;
        this.y = 1;
        this.direction = noDirection;
        this.facetimeout = null;
        this.img = smileFace;
        this.dead = false;
        this.speed = 10;
        this.direction = noDirection;
        this.moveInterval = setInterval(() => this.move(), 1000 / this.speed);
        this.powerupInterval = setInterval(() => this.digest(), 100);
        this.lastFrame = Date.now();
        this.controls = {
            mouseButton: false,
            latestKeys: [],
        } 
        this.path = [];
    }

    locate(x, y) {
        this.x = x;
        this.y = y;
        this.start_x = x;
        this.start_y = y;
    }

    respawn() {
        gameBoardMap.grid[this.y][this.x].obstruction = null;
        this.x = this.start_x;
        this.y = this.start_y;
        resetMap();
        this.dead = false;
        this.img = smileFace;
    }

    resetFace() {
        if (this.invincible)
            this.img = starEyes;
        else if (this.dead) 
            this.img = deadFace;
        else this.img = smileFace;
    }

    die() {
        if (this.dead) return;
        this.dead = true;
        this.direction = noDirection;
        this.controls.latestKeys = [];
        this.path = [];
        this.img = deadFace;
        setTimeout(() => {
           this.respawn();
        }, 2000);
    }

    digest() {
        if (paused) return;
        if (this.dead) return;
        this.invincible = Math.max(this.invincible -1 , 0);
        if (0 < this.invincible && this.invincible < 15) {
            this.img = smileFace;
            setTimeout(() => {
                this.resetFace();
            }, 50);
        }
        else if (this.invincible == 0) {
            this.resetFace();
        }
    }

    move() {
        if (paused) return;
        if (this.dead) return;

        this.lastFrame = Date.now();
    
        this.x += this.direction.x;
        this.y += this.direction.y;
        // a trail that monsters can smell?
        gameBoardMap.grid[this.y][this.x].obstruction = NaN;
    
        let xdif = Math.round(mousePos.x * gameBoardWidth) - this.x;
        let ydif = Math.round(mousePos.y * gameBoardHeight) - this.y;
        let activeMotions = this.controls.latestKeys.map(key => key);

        if (this.controls.mouseButton && (xdif || ydif)) {
            if (Math.abs(xdif) < Math.abs(ydif)) {
                if (xdif > 0) {
                    activeMotions.push("MouseRight")
                }
                else if (xdif < 0) {
                    activeMotions.push("MouseLeft")
                }
            }
            if (ydif < 0) {
                activeMotions.push("MouseUp")
            }
            else if (ydif > 0) {
                activeMotions.push("MouseDown")
            }
            if (Math.abs(xdif) >= Math.abs(ydif)) {
                if (xdif > 0) {
                    activeMotions.push("MouseRight")
                }
                else if (xdif < 0) {
                    activeMotions.push("MouseLeft")
                }
            }
        }
        else this.controls.mouseButton = false;
        
        if (this.path.length == 0) {
            let currentDirection = this.direction;
            let newDirection = undefined;
            this.direction = noDirection;
            for (let i = activeMotions.length - 1; i >= 0; i--) {
                let key = activeMotions[i];
                if ((key === "ArrowUp" || key === "MouseUp") && this.y > 0) {
                    newDirection = directions[3];
                }
                else if ((key === "ArrowDown"  || key === "MouseDown") && this.y < gameBoardHeight - 1) {
                    newDirection = directions[1];
                }
                else if ((key === "ArrowLeft"  || key === "MouseLeft") && this.x > 0) {
                    newDirection = directions[2];
                }
                else if ((key === "ArrowRight"  || key === "MouseRight") && this.x < gameBoardWidth - 1) {
                    newDirection = directions[0];
                }
                if (newDirection && gameBoardMap.grid[this.y + newDirection.y][this.x + newDirection.x].passableByPlayer) {
                    if (this.direction === noDirection) {
                        this.direction = newDirection;
                    }
                    // always prefer to go in a direction you're not currently going
                    if (newDirection != currentDirection) {
                        this.direction = newDirection;
                        break;
                    }
                }
            }
        }
        else {
            let nextmove = this.path.shift();
            if (nextmove.x > this.x) this.direction = directions[0];
            if (nextmove.y > this.y) this.direction = directions[1];
            if (nextmove.x < this.x) this.direction = directions[2];
            if (nextmove.y < this.y) this.direction = directions[3];
            if (!gameBoardMap.grid[this.y + this.direction.y][this.x + this.direction.x].passableByPlayer) this.direction = noDirection;
        }
    
        if (gameBoardMap.grid[this.y][this.x].powerUp) {
    
            gameBoardMap.grid[this.y][this.x].powerUp.eat();
    
            // was that the last of them??
            if (donutsRemaining === 0) {
                // X's on map explode
                gameBoardMap.grid.forEach((row, y) => {
                    row.forEach((location, x) => {
                        if (location.terrain === "X" || location.terrain === "x") {
                            // capital Xs become escape route
                            if (location.terrain === "X") {
                                gameBoardMap.grid[y][x].terrain = "O";
                                // block monsters from going out this way
                                gameBoardMap.grid[y][x].obstruction = {type: "escape"};
                            }
                            else {
                                gameBoardMap.grid[y][x].terrain = "o";
                                gameBoardMap.grid[y][x].obstruction = "";
                            }
                            let explosionImg = $("<img>")
                                .attr("src", "/images/boom.gif")
                                .css({
                                    "top": y/gameBoardHeight*100 + "vmin",
                                    "left": "Calc(" + x/gameBoardWidth*100 + "vmin + " + 
                                    ($(document).width() - $("#gameCanvas").width())/ 2 + "px)",
                                    "height": 1/gameBoardHeight*100 + "vmin",
                                    "width": 1/gameBoardWidth*100 + "vmin",
                                    "z-index": "100"
                                })
                                .addClass("blockimg")
                                .appendTo(document.body)
                            setTimeout(() => {
                                explosionImg.remove();
                            }, 1000);
                        }
                    })
                })
            }
        }
        if (gameBoardMap.grid[this.y][this.x].terrain === "O") {
            // next level
            console.log("next level!");
            pause();
            $("#gameCanvas").addClass("swipeUp");
            let swipeInterval = setInterval(() => {
                swipeAnimation ++;
            }, 33);
            setTimeout(() => {
                clearInterval(swipeInterval);
                window.location.href="/game/" + (parseInt($("#levelNumber").text()) + 1);
            }, 1000);
        }
    
    }
}
let player;

class Monster {
    constructor(x, y, name = "angry") {
        this.x = x;
        this.y = y;
        this.lastFrame = Date.now();
        if (name === "devil") {
            this.img = devilFace;
            this.speed = 10;
            this.followDistance = 99;
            this.pathFinder = 0.01;
        }
        else if (name === "Devil") {
            this.img = devilFace;
            this.speed = 10;
            this.followDistance = 99;
            // the real deal.  he's always on your tail.
            this.pathFinder = 1;
        }
        else if (name === "angry") {
            this.img = angryFace;
            this.speed = 6;
            this.followDistance = 10;
        }
        else if (name === "irk") {
            this.img = irkFace;
            this.speed = 4;
            this.followDistance = 4;
        }
        else if (name === "turd") {
            this.img = turdFace;
            this.speed = 2;
            this.followDistance = 99;
            this.pathFinder = 1.0;
        }
        this.direction = noDirection;
        this.path = [];
        this.moveInterval = setInterval(() => this.move(), 1000 / this.speed)
        this.start_position = {x: x, y: y};
        this.type = "monster";
        this.species = name;
        this.mainImg = this.img;
    }

    die() {
        this.dead = true;
        gameBoardMap.grid[this.y + this.direction.y][this.x + this.direction.x].obstruction = null;
        this.x += this.offset.x;
        this.y += this.offset.y;
        this.direction = {
            x: (this.start_position.x - this.x) / (this.speed * 10),
            y: (this.start_position.y - this.y) / (this.speed * 10)
        }
        this.img = ghost;
        this.respawnTimeout = setTimeout(() => {
            this.direction = noDirection;
            this.dead = false;
            this.x = this.start_position.x;
            this.y = this.start_position.y;
            this.img = this.mainImg;
        }, 10000);
    }

    float() {
        this.x += this.direction.x;
        this.y += this.direction.y;
        this.lastFrame = Date.now();
    }

    respawn() {
        if (!this.dead) {
            gameBoardMap.grid[this.y][this.x].obstruction = false;
            gameBoardMap.grid[this.y + this.direction.y][this.x + this.direction.x].obstruction = false;
        }
        else {
            clearTimeout(this.respawnTimeout);
            this.dead = false;
            this.img = this.mainImg;
        }
        this.x = this.start_position.x;
        this.y = this.start_position.y;
        this.direction = noDirection;
        this.path=[];
    }

    move() {
        if (paused) return;
        if (this.dead) {this.float(); return;}
        // first thing's first
        this.x += this.direction.x;
        this.y += this.direction.y;

        // check which options are available to move towards
        var newDirection;
        let newMoveOptions = directions.reduce((sum, direction, i) => {
            if (!gameBoardMap.grid[this.y + direction.y][this.x + direction.x].passable ||
                Math.abs(direction.index - this.direction.index) === 2) {
                return sum;
            }
            else {
                return sum + 2 ** i;
            }
        }, 0);

        if (this.pathFinder > Math.random()) this.findPath();
        if (this.path.length === 0) {
        // non-pathfinding monster movement rules:

        // 1. don't reverse course unless there is no other option, or
        // 2. when a new path (which isn't a course reversal) becomes available, 
        // (randomly) consider taking it
            
            // they will change direction when options for moving change
            // either hitting a wall, or coming across a new passage
            if ((newMoveOptions | this.moveOptions) != this.moveOptions || 
                !(newMoveOptions & 2 ** this.direction.index) || player.invincible) {
                newDirection = directions[0];
 
                let xdif = player.x - this.x;
                let ydif = player.y - this.y;
                if (player.invincible) {
                    // when the player is invincible, we want to run away instead
                    xdif = -xdif;
                    ydif = -ydif;
                }
                if (xdif + ydif < this.followDistance) {
                // // try to move toward player first
                    if (Math.floor(Math.random() * (Math.abs(xdif) + Math.abs(ydif))) < Math.abs(xdif)) {
                        newDirection = xdif > 0 ? directions[0] : directions[2];
                    }
                    else {
                        newDirection = ydif > 0 ? directions[1] : directions[3];
                    }
                }
                // but if that's not going to work out, due to a wall,
                // or because it would be going backwards...
                if (!gameBoardMap.grid[this.y + newDirection.y][this.x + newDirection.x].passable 
                    || Math.abs(newDirection.index - this.direction.index) === 2 && !player.invincible) {
                        directions.forEach((direction, i) => {
                            // go anywhere but backwards
                            if (Math.abs(this.direction.index - i) != 2 &&
                            gameBoardMap.grid[this.y + direction.y]
                            [this.x + direction.x].passable) {
                                newDirection = direction;
                            } 
                        })
                }
                this.direction = newDirection;
            }
        }
        else {
            // pathfinding: track directly toward the player on the
            // shortest possible computed path
            let nextmove = this.path.shift();
            if (nextmove.x > this.x) this.direction = directions[0];
            if (nextmove.y > this.y) this.direction = directions[1];
            if (nextmove.x < this.x) this.direction = directions[2];
            if (nextmove.y < this.y) this.direction = directions[3];
            if (player.invincible) this.direction = directions[(this.direction.index + 2) % 4]
        }

        // make sure this is gonna work
        let tries = 0;
        while (!gameBoardMap.grid[this.y + this.direction.y]
            [this.x + this.direction.x].passable && tries < 4) {
                // hit a wall - change direction
                // should only ever happen in the case of a dead end
                this.direction = directions[(this.direction.index + 1) % directions.length];
                tries ++;
            }
        
        // in the event that they are totally stuck, don't move this round
        // this is probably because they are hemmed in by other monsters
        if (tries == 4) this.direction = {x: 0, y: 0, index: -1};

        this.moveOptions = newMoveOptions | 2 ** this.direction.index;

        // clear the current location
        gameBoardMap.grid[this.y][this.x].obstruction = null;

        // block off the square we are moving into
        gameBoardMap.grid[this.y + this.direction.y][this.x + this.direction.x].obstruction = this;

        this.lastFrame = Date.now();
    }
    findPath() {
        this.path = pathFinder.search(gameBoardMap, gameBoardMap.grid[this.y][this.x], gameBoardMap.grid[player.y][player.x])
    }
}
let monsters = [];

$(document).ready(() => {
    let trackButtons = [];
    for (let n = 0; n < 9; n++) {
        trackButtons.push(
            $("<div>")
            .addClass("trackButton")
            .click((event) => {$(".trackButton").removeClass("outline"); $(event.target).addClass("outline")})
            .css({"left": `${33.33 * (n % 3)}%`, "top": `${33.33 * Math.floor(n/3)}%`})
        )
    }
    trackButtons[0].click(() => {player.controls.latestKeys = ["ArrowLeft", "ArrowUp"]})
    trackButtons[1].click(() => {player.controls.latestKeys = ["ArrowUp"]})
    trackButtons[2].click(() => {player.controls.latestKeys = ["ArrowRight", "ArrowUp"]})
    trackButtons[3].click(() => {player.controls.latestKeys = ["ArrowLeft"]})
    trackButtons[4].click(() => {player.controls.latestKeys = []})
    trackButtons[5].click(() => {player.controls.latestKeys = ["ArrowRight"]})
    trackButtons[6].click(() => {player.controls.latestKeys = ["ArrowLeft", "ArrowDown"]})
    trackButtons[7].click(() => {player.controls.latestKeys = ["ArrowDown"]})
    trackButtons[8].click(() => {player.controls.latestKeys = ["ArrowRight", "ArrowDown"]})
    $("#trackPad").append(trackButtons);

    // player input
    $(document).on("keydown", function(e) {
        let coldStart = player.offset.x === 0 && player.offset.y === 0;
        if (!player.controls.latestKeys.includes(e.key)) {
            player.controls.latestKeys.push(e.key);
        }
        if (e.key===" ") {
            if (paused) unPause();
            else pause();
        }
        if (coldStart) {
            // start moving immediately, instead of waiting for the next time player.move fires
            clearInterval(player.moveInterval);
            player.moveInterval = setInterval(() => {
                player.move()
            }, 1000 / player.speed);
            player.move();
        }
    })
    $(document).on("keyup", function(e) {
        let keyAt = player.controls.latestKeys.indexOf(e.key);
        if (keyAt >= 0) {
            player.controls.latestKeys.splice(keyAt, 1);
        }
    })

    $("canvas").on("click", function(e) {
        // player.controls.mouseButton = true;
        mousePos = {x: (event.clientX - $("canvas").position().left) / $("canvas").width(), y: (event.clientY - $("canvas").position().top) / $("canvas").height()}
        destination = {
            x: mousePos.x * gameBoardWidth,
            y: mousePos.y * gameBoardHeight
        }
        if (!gameBoardMap.grid[Math.floor(destination.y)][Math.floor(destination.x)].passableByPlayer) {
            // a bit of error correction
            if (destination.x > 0.5 && destination.x < gameBoardWidth - 0.5 && 
                gameBoardMap.grid[Math.floor(destination.y)][Math.floor(destination.x + (destination.x % 1 > .5 ? 1 : -1))].passableByPlayer) {
                    destination.x += (destination.x % 1 > .5 ? 1 : -1)
            }
            else if (destination.y > 0.5 && destination.y < gameBoardHeight - 0.5 &&
                gameBoardMap.grid[Math.floor(destination.y + (destination.y % 1 > .5 ? 1 : -1))][Math.floor(destination.x)].passableByPlayer) {
                    destination.y += (destination.y % 1 > .5 ? 1 : -1)
            }
            else if (destination.x > 0.5 && destination.x < gameBoardWidth - 0.5 &&
                destination.y > 0.5 && destination.y < gameBoardHeight - 0.5 &&
                gameBoardMap.grid[Math.floor(destination.y + (destination.y % 1 > .5 ? 1 : -1))][Math.floor(destination.x + (destination.x % 1 > .5 ? 1 : -1))].passableByPlayer) {
                    destination.x += (destination.x % 1 > .5 ? 1 : -1)
                    destination.y += (destination.y % 1 > .5 ? 1 : -1)
            }
        }
        player.path = pathFinder.search(
            gameBoardMap, gameBoardMap.grid[player.y + player.direction.y][player.x + player.direction.x], 
            gameBoardMap.grid[Math.floor(destination.y)][Math.floor(destination.x)], {isPlayer: true}
        )
     })
    $(document).on("mouseup", function(e) {
        player.controls.mouseButton = false;
    })
    
    $("#gameCanvas").mousemove(function(event) {
        // $("#mousepos").text(event.clientX + " " + event.clientY);
    })

    // load images
    bricksImg = document.getElementById("bricksImg")
    smileFace = document.getElementById("smileFace")
    tongueFace = document.getElementById("tongueFace")
    angryFace = document.getElementById("angryFace")
    irkFace = document.getElementById("irkedFace")
    turdFace = document.getElementById("poopFace")
    devilFace = document.getElementById("devilFace")
    deadFace = document.getElementById("deadFace")
    starEyes = document.getElementById("starEyes")
    ghost = document.getElementById("ghost")

    loadGame();

    requestAnimationFrame(drawGameBoard);

})

let mousePos = {x: 0, y: 0};

function loadGame() {
    // reset monsters, player, and donuts
    monsters = [];
    player = new Player();
    donutsRemaining = 0
    // load map
    let mapText = $("#levelData").text()
        .split("\n").map((line) => {
            return line.split('');
    });
    let loadingMap = Array(mapText.length)
    mapText.forEach((row, y) => {
        loadingMap[y] = Array(row.length)
        row.forEach((char, x) => {
            loadingMap[y][x] = new mapLocation(char, x, y);
        })
    })

    // get a node-based interpretation of the map
    gameBoardMap = new Graph(loadingMap.map(row => {
        return row.map(node => {
            return node.passable ? 1 : 0;
        })
    }))
    // merge the two into one
    for (let y = 0; y < gameBoardMap.grid.length; y++) {
        for (let x = 0; x < gameBoardMap.grid[y].length; x++) {
            loadingMap[y][x].neighbors =  gameBoardMap.grid[y][x].neighbors;
            gameBoardMap.grid[y][x] = loadingMap[y][x]
        }
    }
    
    // testing::
    // donutsRemaining = 1;
    maximumDonuts = donutsRemaining;

    // load canvas
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext('2d');

    // calculate dimensions
    gameCellWidth = canvas.width / gameBoardWidth;
    gameCellHeight = canvas.height / gameBoardHeight;

}

function resetMap() {
    // put back ten percent of donuts
    const enoughDonuts = Math.min(donutsRemaining + maximumDonuts / 10, maximumDonuts);
    const firstDonut = Math.floor(Math.random() * maximumDonuts);
    let approxDist = (x, y) => Math.max(Math.abs(x - 13), Math.abs(y - 13))

    donuts.sort((a, b) => {
        if (approxDist(a.x, a.y) > approxDist(b.x, b.y))
            return -1
        else if (approxDist(a.x, a.y) < approxDist(b.x, b.y))
            return 1
        else if (a.x > b.x)
            return -1
        else if (b.x > a.x)
            return 1
        else if (a.y > b.y)
            return -1
        else return 1
    })
        
    for (let i = 0; i < maximumDonuts; i++) {
        let n = (i + firstDonut) % maximumDonuts;
        if (!donuts[n].exists) {
            donuts[n].respawn();
        }
        if (donutsRemaining >= enoughDonuts) {
            break;
        }
    }
    // monsters
    monsters.forEach(monster => {
        monster.respawn();
    })
    // powerups
    powerUps.forEach(powerup => {
        powerup.respawn();
    })
    // close down escape route
    gameBoardMap.grid.forEach((row, y) => {
        row.forEach((char, x) => {
            if (gameBoardMap.grid[y][x].terrain === "O") {
                gameBoardMap.grid[y][x].terrain = "X";
                gameBoardMap.grid[y][x].obstruction = "wall";
            }
            else if (gameBoardMap.grid[y][x].terrain === "o") {
                gameBoardMap.grid[y][x].terrain = "x";
                gameBoardMap.grid[y][x].obstruction = "wall";
            }
        })
    })
}

function drawGameBoard() {
    ctx.clearRect(0, 0,
        canvas.width, canvas.height)

    for (let x = 0; x < gameBoardWidth; x++) {
        for (let y = 0; y < gameBoardHeight; y++) {

            if (gameBoardMap.grid[y][x].terrain === "*" || gameBoardMap.grid[y][x].terrain.toLowerCase() === "x") {
                ctx.drawImage(bricksImg, 
                    gameCellWidth * x, gameCellHeight * (y - swipeAnimation),
                    gameCellWidth, gameCellHeight)
            }
            else if (gameBoardMap.grid[y][x].terrain === "+") {
                ctx.drawImage(donutImg, 
                    gameCellWidth * x, gameCellHeight * (y - swipeAnimation),
                    gameCellWidth, gameCellHeight)
            }
        }
    }
    powerUps.forEach(powerup => {
        if (powerup.exists) {
            ctx.drawImage(powerup.img, 
                gameCellWidth * powerup.x, gameCellHeight * (powerup.y - swipeAnimation),
                gameCellWidth, gameCellHeight)
        }
    })

    // draw monsters
    monsters.forEach(monster => {
        monster.offset = {
            x: monster.direction.x * Math.min((Date.now() - monster.lastFrame) / 1000 * monster.speed, 1),
            y: monster.direction.y * Math.min((Date.now() - monster.lastFrame) / 1000 * monster.speed, 1),
        }
        if (monster.dead) ctx.globalAlpha = 0.5;
        else ctx.globalAlpha = 1;
        ctx.drawImage (monster.img, 
            gameCellWidth * (monster.x + monster.offset.x), 
            gameCellHeight * (monster.y + monster.offset.y - swipeAnimation),
            gameCellWidth, gameCellHeight)
            ctx.globalAlpha = 1;
        if (monster.dead) {
            // grave stone
            ctx.drawImage (graveImg, 
                gameCellWidth * monster.start_position.x, 
                gameCellHeight * (monster.start_position.y - swipeAnimation),
                gameCellWidth, gameCellHeight)
            }
        })
    
    // draw player
    if (!player.dead) player.offset = {
        x: player.direction.x * Math.min((Date.now() - player.lastFrame) / 1000 * player.speed, 1),
        y: player.direction.y * Math.min((Date.now() - player.lastFrame) / 1000 * player.speed, 1)
    }
    ctx.drawImage (player.img, 
        gameCellWidth * (player.x + player.offset.x), gameCellHeight * (player.y + player.offset.y - swipeAnimation),
        gameCellWidth, gameCellHeight)
    
    
    // check monster collisionss
    monsters.forEach(monster => {
        if (!monster.dead) {
            if (Math.abs(player.x + player.offset.x - monster.x - monster.offset.x) < 1 
            && Math.abs(player.y + player.offset.y - monster.y - monster.offset.y) < 1) {
                if (player.invincible)
                    monster.die();
                else
                    player.die();
            }
        }
    })

    // console.log('frame rendered');
    requestAnimationFrame(drawGameBoard);
}

function pause() { 
    paused = true 
    $("#startButton").show();
}
function unPause() {
    paused = false;
    $("#startButton").hide();
}
