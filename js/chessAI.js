/*jslint bitwise: true*/

var ChessBoard,
    Chess,
    board,
    game = new Chess(),
    aiColor = 'b',
    autoPlayBoolean = 0,
    INFINITY = 999999999,
	FEN,
	PGN,
    table = new Array(64),
    transpositionTable,
    transpositionTableSize = 1005,
    moveStartTime,
    $,
    XMLHttpRequest,
    document,
    window;


//Update FEN string and PGN on server and also prints them out on webpage.
var updateFenPgn = function () {
    "use strict";
	if (game.in_checkmate() === true) {
		if (game.turn() === 'b') {
			PGN = game.pgn();
			PGN = PGN + " 1-0"; //add 1-0 to PGN represent White won
			FEN = game.fen();
        } else {
			PGN = game.pgn();
            PGN = PGN + " 0-1"; //add 0-1 to PGN to represent Black won
			FEN = game.fen();
        }
	} else if (game.in_stalemate() === true || game.in_draw() === true || game.insufficient_material() === true) {
		PGN = game.pgn();
		PGN = PGN + " 1/2-1/2"; //add 1/2-1/2 to PGN to represent a draw
		FEN = game.fen();
	} else {
		PGN = game.pgn();
		FEN = game.fen();
	}
    
    FEN = game.fen();

    $('#FEN').text(FEN);
    $('#PGN').text(PGN);
};


function sendStartOfGameFEN() {
    "use strict";
    var xhttp = new XMLHttpRequest(),
        start = "Start of Game: \n" + game.fen();

	xhttp.open("POST", "/cgi-bin/sendFen.cgi");
	xhttp.setRequestHeader("content-type", "application/x-www-form-urlencoded");
	xhttp.send("start=" + start);
}

//Uses AJAX to call sendFen.cgi script, which adds the boards current FEN to a log on the server
function sendFEN() {
	"use strict";
    var xhttp = new XMLHttpRequest(),
        fen = FEN;

	xhttp.open("POST", "/cgi-bin/sendFen.cgi");
	xhttp.setRequestHeader("content-type", "application/x-www-form-urlencoded");
	xhttp.send("fen=" + fen);
}

//Uses AJAX to call sendPGN.cgi script, which adds the game's PGN a log on the server
function sendPGN() {
    "use strict";
	var xhttp = new XMLHttpRequest(),
        pgn = PGN;

	xhttp.open("POST", "/cgi-bin/sendPGN.cgi");
	xhttp.setRequestHeader("content-type", "application/x-www-form-urlencoded");
	xhttp.send("pgn=" + pgn);
}

//Alerts webpage if game is over, and sends the final FEN and PGN to the server
var checkGameStatus = function () {
    "use strict";
    if (game.in_checkmate() === true) {
        if (game.turn() === 'b') {
            $("#blackInCheckmate").fadeTo(10000, 500).slideUp(500);
        } else {
            $("#whiteInCheckmate").fadeTo(10000, 500).slideUp(500);
        }
		updateFenPgn();
        sendPGN();
		sendFEN();
        autoPlayBoolean = 0;
    } else if (game.in_stalemate() === true) {
        $("#stalemate").fadeTo(10000, 500).slideUp(500);
        updateFenPgn();
        sendPGN();
		sendFEN();
        autoPlayBoolean = 0;
    } else if (game.in_draw() === true) {
        $("#drawnPosition").fadeTo(10000, 500).slideUp(500);
        updateFenPgn();
        sendPGN();
        sendFEN();
        autoPlayBoolean = 0;
    } else if (game.insufficient_material() === true) {
        $("#insufficientMaterial").fadeTo(10000, 500).slideUp(500);
        updateFenPgn();
        sendPGN();
        sendFEN();
        autoPlayBoolean = 0;
    }
};

//AI starts
//Zoborist hashing and transposition table


var indexOf = function (piece) {
    "use strict";
    if (piece === "P") {
        return 0;
    }
    if (piece === "N") {
        return 1;
    }
    if (piece === "B") {
        return 2;
    }
    if (piece === "R") {
        return 3;
    }
    if (piece === "Q") {
        return 4;
    }
    if (piece === "K") {
        return 5;
    }
    if (piece === "p") {
        return 6;
    }
    if (piece === "n") {
        return 7;
    }
    if (piece === "b") {
        return 8;
    }
    if (piece === "r") {
        return 9;
    }
    if (piece === "q") {
        return 10;
    }
    if (piece === "k") {
        return 11;
    } else {
        return -1;
    }
};

var validChar = function (positionOnBoard) {
    "use strict";
    //console.log(string);
    if (positionOnBoard === 'P' || positionOnBoard === 'R' || positionOnBoard === 'N' || positionOnBoard === 'B' || positionOnBoard === 'Q' || positionOnBoard === 'K' || positionOnBoard === 'p' || positionOnBoard === 'r' || positionOnBoard === 'n' || positionOnBoard === 'b' || positionOnBoard === 'q' || positionOnBoard === 'k' || positionOnBoard === '.') {
        return true;
    } else {
        return false;
    }
};

// game.ascii() (which creates a string to represent the current board position in ascii) and loops through the array, parsing out everything that's not
// a piece or empy space on the board. 
var getBoardPosition = function (game) {
    "use strict";
    var boardPos = game.ascii().split(" "),
        boardRep = "",
        i;

    for (i = 0; i < boardPos.length; i += 1) {
        if (validChar(boardPos[i]) === true) {
            boardRep += boardPos[i] + " ";
        }
    }
    return boardRep.split(" ");
};

function absoluteValue(number) {
    "use strict";
    if (number < 1) {
        return number * -1;
    } else {
        return number;
    }
}

function initZobristHash() {
    "use strict";
    var i,
        j;
    
    for (i = 0; i < 64; i += 1) {
        table[i] = new Array(12);
    }
    
    
    for (i = 0; i < 64; i += 1) {
        for (j = 0; j < 12; j += 1) {
            table[i][j] = absoluteValue(Math.floor(Math.random() * Math.pow(2, 64)));
        }
    }
}
   
function getHashKey(game) {
    "use strict";
    var h = 0,
        boardPos = getBoardPosition(game),
        i,
        j;
    
    for (i = 0; i < 64; i += 1) {
        if (boardPos[i] !== ".") {
            j = indexOf(boardPos[i]);
            h = absoluteValue(h ^ table[i][j]);
        }
    }
    return h;
}

function initTranspositionTable() {
    "use strict";
    var i;
    transpositionTable = new [].constructor(transpositionTableSize);
    for (i = 0; i < transpositionTableSize; i += 1) {
        transpositionTable[i] = "null";
    }
}

function storeTranspositionTableEntry(zobristKey, flag, depth, value) {
    "use strict";
    var entry = [zobristKey, flag, depth, value];
    transpositionTable[absoluteValue(zobristKey % transpositionTableSize)] = entry;
}

function getTranspositionTableEntry(zobristKey) {
    "use strict";
    var entryLocation = transpositionTable[absoluteValue(zobristKey % transpositionTableSize)];
    if (entryLocation[0] === zobristKey) {
        return entryLocation;
    } else {
        return "null";
    }
}

//Piece-Square Tables from chessprogramming.com. Modified slightly to tune to how I want to AI to play
var evalBlackPawn = [
    [ 0,  0,   0,   0,   0,   0,  0,  0],
    [ 5, 10,  10, -20, -20,  10, 10,  5],
    [ 5, -5, -10,   0,   0, -10, -5,  5],
    [ 0,  0,   0,  20,  20,   0,  0,  0],
    [ 5,  5,  10,  25,  25,  10,  5,  5],
    [10, 10,  20,  30,  30,  20, 10, 10],
    [50, 50,  50,  50,  50,  50, 50, 50],
    [ 0,  0,   0,   0,   0,   0,  0,  0]
];

var evalWhitePawn = evalBlackPawn.slice().reverse();

var evalBlackKnight = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20,   0,   5,   5,   0, -20, -40],
    [-30,   5,  10,  15,  15,  10,   5, -30],
    [-30,   0,  15,  20,  20,  15,   0, -30],
    [-30,   5,  15,  20,  20,  15,   5, -30],
    [-30,   0,  10,  15,  15,  10,   0, -30],
    [-40, -20,   0,   0,   0,   0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50]
];

var evalWhiteKnight = evalBlackKnight.slice().reverse();

var evalBlackBishop = [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10,   5,   0,   0,   0,   0,   5, -10],
    [-10,  10,  10,  10,  10,  10,  10, -10],
    [-10,   0,  10,  10,  10,  10,   0, -10],
    [-10,   5,   5,  10,  10,   5,   5, -10],
    [-10,   0,   5,  10,  10,   5,   0, -10],
    [-10,   0,   0,   0,   0,   0,   0, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20]
];

var evalWhiteBishop = evalBlackBishop.slice().reverse();

var evalBlackRook = [
    [  0,  0,  0,  5,  5,  0,  0,  0],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [  0,  0,  0,  0,  0,  0,  0,  0]
];

var evalWhiteRook = evalBlackRook.slice().reverse();

var evalBlackQueen = [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10,   0,   5,  0,  0,   0,   0, -10],
    [-10,   5,   5,  5,  5,   5,   0, -10],
    [  0,   0,   5,  5,  5,   5,   0,  -5],
    [ -5,   0,   5,  5,  5,   5,   0,  -5],
    [-10,   0,   5,  5,  5,   5,   0, -10],
    [-10,   0,   0,  0,  0,   0,   0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20]
];

var evalWhiteQueen = evalBlackQueen.slice().reverse();

var evalBlackKing = [
    [ 20,  30,  10,   0,   0,  10,  30,  20],
    [ 20,  20,   0,   0,   0,   0,  20,  20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30]
];

var evalWhiteKing = evalBlackKing.slice().reverse();

var checkOrientation = function () {
    "use strict";
    if (aiColor === 'white') {
        evalBlackPawn = evalBlackPawn.slice().reverse();
        evalBlackRook = evalBlackRook.slice().reverse();
        evalBlackBishop = evalBlackBishop.slice().reverse();
        evalBlackKnight = evalBlackKnight.slice().reverse();
        evalBlackQueen = evalBlackQueen.slice().reverse();
        evalBlackKing = evalBlackKing.slice().reverse();
        evalWhitePawn = evalWhitePawn.slice().reverse();
        evalWhiteRook = evalWhiteRook.slice().reverse();
        evalWhiteBishop = evalWhiteBishop.slice().reverse();
        evalWhiteKnight = evalWhiteKnight.slice().reverse();
        evalWhiteQueen = evalWhiteQueen.slice().reverse();
        evalWhiteKing = evalWhiteKing.slice().reverse();
    }
};

//Evaluation function

var evaluateBoard = function (board) {
    "use strict";
    checkOrientation();
    
    var evaluation = 0,
        i = 0,
        j = 0,
        piece,
        
        getPieceValue = function (piece, x, y) {
            if (piece.type === null) {
                return 0;
            }
            var getAbsoluteValue = function (piece) {
                if (piece.type === 'p') {
                    if (piece.color === 'b') {
                        return 100 + evalBlackPawn[x][y];
                    } else {
                        return 100 + evalWhitePawn[x][y];
                    }
                } else if (piece.type === 'r') {
                    if (piece.color === 'b') {
                        return 500 + evalBlackRook[x][y];
                    } else {
                        return 500 + evalWhiteRook[x][y];
                    }
                } else if (piece.type === 'n') {
                    if (piece.color === 'b') {
                        return 320 + evalBlackKnight[x][y];
                    } else {
                        return 320 + evalWhiteKnight[x][y];
                    }
                } else if (piece.type === 'b') {
                    if (piece.color === 'b') {
                        return 320 + evalBlackBishop[x][y];
                    } else {
                        return 320 + evalWhiteBishop[x][y];
                    }
                } else if (piece.type === 'q') {
                    if (piece.color === 'b') {
                        return 900 + evalBlackQueen[x][y];
                    } else {
                        return 900 + evalWhiteQueen[x][y];
                    }
                } else if (piece.type === 'k') {
                    if (piece.color === 'b') {
                        return 20000 + evalBlackKing[x][y];
                    } else {
                        return 20000 + evalWhiteKing[x][y];
                    }
                }
                throw "Unknown piece type: " + piece.type;
            };

            if (aiColor !== piece.color) {
                if (game.in_checkmate() === true) {
                    return -INFINITY;
                } else {
                    return -getAbsoluteValue(piece);
                }
            } else {
                if (game.in_checkmate() === true) {
                    return INFINITY;
                } else {
                    return getAbsoluteValue(piece);
                }
            }
        };
    
    for (i = 0; i < 8; i += 1) {
        for (j = 0; j < 8; j += 1) {
            if (board[i][j] !== null) {
                piece = board[i][j];
                evaluation = evaluation + getPieceValue(piece, i, j);
            }
        }
    }
    return evaluation;
};

var alphabeta = function (game, depth, alpha, beta, maximizingPlayer) {
    "use strict";
    var a = alpha,
        b = beta,
        gameMoves,
        v,
        i,
        j,
        transpositionTableEntry = getTranspositionTableEntry(getHashKey(game));

    if (transpositionTableEntry !== "null"  && transpositionTableEntry[2] >= depth) {
        if (transpositionTableEntry[1] === "EXACT") {
            return transpositionTableEntry[3];
        }
        if (transpositionTableEntry === "LOWERBOUND" && transpositionTableEntry[3] > a) {
            a = transpositionTableEntry[3];           // update lowerbound alpha if needed
        } else if (transpositionTableEntry[1] === "UPPERBOUND" && transpositionTableEntry[3] < b) {
            b = transpositionTableEntry[3];           // update upperbound beta if needed
        }
        if (a >= b) {
            return transpositionTableEntry[3];            // if lowerbound surpasses upperbound   
        }
    }
    
    if (depth === 0) {
        v = evaluateBoard(game.board());
        if (v <= a) {
            // a lowerbound value
            storeTranspositionTableEntry(getHashKey(game), "LOWERBOUND", depth, v);
        } else if (v >= b) {
            // an upperbound value
            storeTranspositionTableEntry(getHashKey(game), "UPPERBOUND", depth, v);
        } else {
            // a true minimax value
            storeTranspositionTableEntry(getHashKey(game), "EXACT", depth, v);
        }
        return v;
    }

    gameMoves = game.moves();
    
    if (maximizingPlayer === true) {
        v = -INFINITY;
        for (i = 0; i < gameMoves.length; i += 1) {
            game.move(gameMoves[i]);
            v = Math.max(v, alphabeta(game, depth - 1, a, b, false));
            a = Math.max(a, v);
            game.undo();
            if (b <= a) {
                break;
            }
            if (new Date().getTime() - moveStartTime > 15000) {
                break;
            }
        }
        
        if (v <= a) {
            // a lowerbound value
            storeTranspositionTableEntry(getHashKey(game), "LOWERBOUND", depth, v);
        } else if (v >= b) {
            // an upperbound value
            storeTranspositionTableEntry(getHashKey(game), "UPPERBOUND", depth, v);
        } else {
            // a true minimax value
            storeTranspositionTableEntry(getHashKey(game), "EXACT", depth, v);
        }
        return v;
    } else {
        v = INFINITY;
        for (j = 0; j < gameMoves.length; j += 1) {
            game.move(gameMoves[j]);
            v = Math.min(v, alphabeta(game, depth - 1, a, b, true));
            b = Math.min(b, v);
            game.undo();
            if (b <= a) {
                break;
            }
            if (new Date().getTime() - moveStartTime > 15000) {
                break;
            }
        }
        if (v <= a) {
            // a lowerbound value
            storeTranspositionTableEntry(getHashKey(game), "LOWERBOUND", depth, v);
        } else if (v >= b) {
            // an upperbound value
            storeTranspositionTableEntry(getHashKey(game), "UPPERBOUND", depth, v);
        } else {
            // a true minimax value
            storeTranspositionTableEntry(getHashKey(game), "EXACT", depth, v);
        }
        return v;
    }
};

var alphaBetaRoot = function (game, depth, maximizingPlayer) {
    "use strict";
    var gameMoves = game.moves(),
        bestMove = -INFINITY,
        bestMoveFound,
        gameMove,
        value,
        i;
        //transpositionTableEntry = getTranspositionTableEntry(getHashKey(game));
    
    for (i = 0; i < gameMoves.length; i += 1) {
        gameMove = gameMoves[i];
        game.move(gameMove);
        value = alphabeta(game, depth - 1, -INFINITY, INFINITY, !maximizingPlayer, true);
        game.undo();
        if (value >= bestMove) {
            bestMove = value;
            bestMoveFound = gameMove;
        }
        //console.log(new Date().getTime() - startTime);
        //if Root search takes longer than 15 seconds, cut off search
        if (new Date().getTime() - moveStartTime > 15000) {
            break;
        }
    }
    return bestMoveFound;
};

var getMove = function (game, depth) {
    "use strict";
    moveStartTime = new Date().getTime();
    var move = alphaBetaRoot(game, depth, true);
    return move;
};

var makeMove = function () {
    "use strict";
    var bestMove,
        depth;
    if (aiColor === 'b') {
        depth = $('input:radio[name="depthBlack"]:checked').val();
        bestMove = getMove(game, depth);
    } else {
        depth = $('input:radio[name="depthWhite"]:checked').val();
        bestMove = getMove(game, depth);
    }
    game.move(bestMove);
    updateFenPgn();
    board.position(game.fen());
    sendFEN();
    checkGameStatus();
    if (aiColor === 'b') {
        $('#blackMoveTime').text((new Date().getTime() - moveStartTime) / 1000 + " seconds");
    } else {
        $('#whiteMoveTime').text((new Date().getTime() - moveStartTime) / 1000 + " seconds");
    }
};

/*var makeRandomMove = function () {
    "use strict";
    var moves = game.moves(),
        move = moves[Math.floor(Math.random() * moves.length)];
    game.move(move);
};*/

var switchAIColor = function () {
    "use strict";
    if (aiColor === 'b') {
        aiColor = 'w';
    } else {
        aiColor = 'b';
    }
};

var switchAI = function () {
    "use strict";
    switchAIColor();
    makeMove();
};

var secondAIAgent = function () {
    "use strict";
    if (game.game_over() !== true) {
        switchAIColor();
        if (autoPlayBoolean === 1) {
            if (aiColor === 'b') {
                makeMove();
                board.position(game.fen());
            } else {
                makeMove();
                board.position(game.fen());
            }
            window.setTimeout(secondAIAgent, 250);
        }
    } else {
        checkGameStatus();
    }
};

//Board Visualization
var onDragStart = function (source, piece) {
    "use strict";
    if (game.game_over() === true || (game.turn() === 'w' && piece.search(/^b/) !== -1) || (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
};

var onDrop = function (source, target) {
    "use strict";
    // see if the move is legal
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    // illegal move
    if (move === null) {
        return 'snapback';
    }
    
    updateFenPgn();
    if (game.in_checkmate() !== true && game.in_stalemate() !== true && game.in_draw() !== true) {
        window.setTimeout(makeMove, 250);
    }
};

// update the board position after the piece snap 
var onSnapEnd = function () {
    "use strict";
    board.position(game.fen());
    sendFEN();
    checkGameStatus();
};

var cfg = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};

board = new ChessBoard('board', cfg);
sendStartOfGameFEN();
updateFenPgn();
initTranspositionTable();
initZobristHash();

$(document).ready(function () {
    "use strict";
    $("#whiteInCheckmate").hide();
    $("#blackInCheckmate").hide();
    $("#stalemate").hide();
    $("#drawnPosition").hide();
    $("#insufficientMaterial").hide();
    $(".btn").mouseup(function () {
        $(this).blur();
    });
});

//buttons
function autoPlay() {
    "use strict";
	if (autoPlayBoolean !== 1) {
        autoPlayBoolean = 1;
        secondAIAgent();
	}
}

function stopAutoPlay() {
    "use strict";
    if (autoPlayBoolean === 1) {
        autoPlayBoolean = 0;
        switchAIColor();
    }
}

function switchAIButton() {
    "use strict";
    if (autoPlayBoolean === 0) {
        switchAI();
    }
}

//Only undoes last move if game is currently not autoplaying.
function undoMove() {
    "use strict";
    if (autoPlayBoolean === 0) {
        game.undo();
        updateFenPgn();
        board.position(game.fen());
    }
}

function flipBoard() {
    "use strict";
    if (autoPlayBoolean === 0) {
        board.flip();
    }
}

//resets the chess game to the start position
function reset() {
    "use strict";
    if (autoPlayBoolean === 0) {
        game.reset();
        board.position(game.fen());
        aiColor = 'b'; //resets aiColor black, which is the ;laskdjf for the beginning of the game
        updateFenPgn();
        initZobristHash();
        initTranspositionTable(); //Clears transposition table for the new game
    }
}

$('#secondAIBtn').on('click', autoPlay);
$('#stopAutoBtn').on('click', stopAutoPlay);
$('#switchAIBtn').on('click', switchAIButton);
$('#undoMoveBtn').on('click', undoMove);
$('#flipOrientationBtn').on('click', flipBoard);
$('#resetBtn').on('click', reset);