/**
*
*   @author: Nicholas Carl
*   @date: 4/23/2018
*   @class: CSCI472: Senior Project
*   @professor: Dr. Marietta Cameron
*   
*   Javascript creates a chess AI agent using Minimax algorithm with alpha-beta pruning and transposition tables using
*   zobrist hashing. The webpage allows for people to play a full game of chess against the AI at the search depth
*   they choose. Users can also choose to switch the color of the AI, or have the game be played by two ai agents
*   to see how AIs using different search depths play against each other.   
*
*   Project website: http://www.chessaiproject.com
*
*   Frameworks used to help with board visualization and chess move/rule set include:
*       chessboard.js (https://github.com/oakmac/chessboardjs)
*       chess.js (https://github.com/jhlywa/chess.js/blob/master/README.md)
*   
*   chessboard represented by 'board' in code. All methods used from chessboard.js show up in code as board.METHOD()
*   chess move/rule set represented by 'game' in code. All methods used from chess.js show up in code as chess.METHOD() 
**/

/*jslint bitwise: true*/

// Initialize global variables
var ChessBoard,
    Chess,
    board,
    game = new Chess(),
    aiColor = 'b',
    autoPlayBoolean = 0,
    INFINITY = 99999,
	FEN,
	PGN,
    table = new Array(64),
    transpositionTable,
    transpositionTableSize = 1005, //magic number. Chosen because 1000 had too many hash collisions.
    moveStartTime,
    $,
    XMLHttpRequest,
    document,
    window;


// Update FEN string and PGN on server and also prints them out on webpage.
function updateFenPgn() {
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
}

// Uses AJAX to call sendFen.cgi script, which adds the boards current FEN to a log on the server
function sendFEN() {
	"use strict";
    var xhttp = new XMLHttpRequest(),
        fen = FEN;

	xhttp.open("POST", "/cgi-bin/sendFen.cgi");
	xhttp.setRequestHeader("content-type", "application/x-www-form-urlencoded");
	xhttp.send("fen=" + fen);
}

// Uses AJAX to call sendPGN.cgi script, which adds the game's PGN a log on the server
function sendPGN() {
    "use strict";
	var xhttp = new XMLHttpRequest(),
        pgn = PGN;

	xhttp.open("POST", "/cgi-bin/sendPGN.cgi");
	xhttp.setRequestHeader("content-type", "application/x-www-form-urlencoded");
	xhttp.send("pgn=" + pgn);
}

// Alerts webpage if game is over, and sends the final FEN and PGN to the server
function checkGameStatus() {
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
}

// AI starts here
// Zobrist hashing and transposition table

// Returns number to represent each different piece on board
function indexOf(piece) {
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
}

// Helps getBoardPosition parse through the ASCII representation of the board position by returning true only if the ASCII character is representing a piece or empty space
function validChar(positionOnBoard) {
    "use strict";
    //console.log(string);
    if (positionOnBoard === 'P' || positionOnBoard === 'R' || positionOnBoard === 'N' || positionOnBoard === 'B' || positionOnBoard === 'Q' || positionOnBoard === 'K' || positionOnBoard === 'p' || positionOnBoard === 'r' || positionOnBoard === 'n' || positionOnBoard === 'b' || positionOnBoard === 'q' || positionOnBoard === 'k' || positionOnBoard === '.') {
        return true;
    } else {
        return false;
    }
}

// Uses game.ascii() (which creates a string to represent the current board position in ascii) and loops through the array, parsing out everything that's not
// a piece or empy space on the board.
// boardPos is an array of the ASCII string. It splits up the string by spaces, so only the characters from game.ascii() are in the array.
// Returns a 1D array representing the current 8x8 board position
function getBoardPosition(game) {
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
}

// Initializes the 64x12 (64 for each position on a chessboard, 12 for each different type of piece) 2D array with random 64bit positive numbers.
function initZobristHashTable() {
    "use strict";
    var i,
        j;
    
    for (i = 0; i < 64; i += 1) {
        table[i] = new Array(12);
    }
    
    
    for (i = 0; i < 64; i += 1) {
        for (j = 0; j < 12; j += 1) {
            table[i][j] = Math.abs((Math.floor(Math.random() * Math.pow(2, 64))));
        }
    }
}
   
// Gets the Zobrist hash key of the current board position by looping through the zobrist hash table and stores the hash key as the bitwise XOR of the current hashkey
// and the zobrist number of the the current square of the board the loop is on.
// Returns the unique hash key of the current board position.
function getHashKey(game) {
    "use strict";
    var hashKey = 0,
        boardPos = getBoardPosition(game),
        i,
        j;
    
    for (i = 0; i < 64; i += 1) {
        if (boardPos[i] !== ".") {
            j = indexOf(boardPos[i]);
            hashKey = Math.abs((hashKey ^ table[i][j]));
        }
    }
    return hashKey;
}

// Initializes the transposition table to a 1D array whose size is the global variable transpositionTableSize
function initTranspositionTable() {
    "use strict";
    var i;
    transpositionTable = new [].constructor(transpositionTableSize);
    for (i = 0; i < transpositionTableSize; i += 1) {
        transpositionTable[i] = "null";
    }
}

// Maps the zobristHashKey, flag, current search depth, and heuristic value of the current board position to the transposition table by
// storing them at the index in the array equal to the zobristHashKey modulus the size of the transposition table.
// flag: a String variable that states whether the current board position is a lowerbound, upperbound, or exact value.
// exact value represents a leaf in the game tree. Lowerbound/upperbound represent a board position that resulted in a alpha/beta cut-off.
function storeTranspositionTableEntry(zobristKey, flag, depth, value) {
    "use strict";
    var entry = [zobristKey, flag, depth, value];
    transpositionTable[Math.abs((zobristKey % transpositionTableSize))] = entry;
}

// Returns the location of the zobristHashKey in the transposition table if it's stored there.
function getTranspositionTableEntry(zobristKey) {
    "use strict";
    var entryLocation = transpositionTable[Math.abs((zobristKey % transpositionTableSize))];
    if (entryLocation[0] === zobristKey) {
        return entryLocation;
    } else {
        return "null";
    }
}

// Piece-Square Tables representing values of each space for each different chess piece
// Initial piece square tables from chessprogramming.com. Modified slightly to tune to how I wanted to AI to play.
var evalBlackPawn = [
    [ 0,  0,   0,   0,   0,   0,  0,  0],
    [ 5, 10,  10, -25, -25,  10, 10,  5],
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

// Evaluation function

// Loops through current board position, finding the value of each piece plus the pieces current position.
// Returns the sum of all the squares values on the board.
function evaluateBoard(board) {
    "use strict";
    var evaluation = 0,
        i = 0,
        j = 0,
        piece,
        
        getPieceValue = function (piece, x, y) {
            if (piece.type === null) {
                return 0;
            }
            function getAbsoluteValue(piece) {
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
                        return 330 + evalBlackBishop[x][y];
                    } else {
                        return 330 + evalWhiteBishop[x][y];
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
            }
            
            // if searching for minimizing player (not the AI), then return a negative value.
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
}

// Minimax with Alpha-Beta pruning
// variables given to call
// game: the current chess game
// depth: search depth
// alpha: alpha value. Initial call alpha = -infinity
// beta: beta value. Initial call beta = infinity
// maximizingPlayer: boolean where true means the search is meant for the maximizing player.
// returns value of board position at leaf in tree, or at position where alpha/beta cut-off occurs 
function alphabeta(game, depth, alpha, beta, maximizingPlayer) {
    "use strict";
    var gameMoves,
        value,
        i,
        j,
        transpositionTableEntry = getTranspositionTableEntry(getHashKey(game));

    // update alpha and beta, or return value based on previous transposition table entries
    if (transpositionTableEntry !== "null"  && transpositionTableEntry[2] >= depth) {
        if (transpositionTableEntry[1] === "EXACT") {
            return transpositionTableEntry[3];
        }
        if (transpositionTableEntry === "LOWERBOUND" && transpositionTableEntry[3] > alpha) {
            alpha = transpositionTableEntry[3];           // update lowerbound alpha if needed
        } else if (transpositionTableEntry[1] === "UPPERBOUND" && transpositionTableEntry[3] < beta) {
            beta = transpositionTableEntry[3];           // update upperbound beta if needed
        }
        if (alpha >= beta) {
            return transpositionTableEntry[3];            // if lowerbound surpasses upperbound   
        }
    }
    
    // return heuristic evaluation value of board
    if (depth === 0) {
        value = evaluateBoard(game.board());
        // store board position in transposition table
        if (value <= alpha) {
            storeTranspositionTableEntry(getHashKey(game), "LOWERBOUND", depth, value);
        } else if (value >= beta) {
            storeTranspositionTableEntry(getHashKey(game), "UPPERBOUND", depth, value);
        } else {
            storeTranspositionTableEntry(getHashKey(game), "EXACT", depth, value);
        }
        return value;
    }

    // get current game moves of the chess match
    gameMoves = game.moves();
    
    if (maximizingPlayer === true) {
        value = -INFINITY;
        for (i = 0; i < gameMoves.length; i += 1) {
            game.move(gameMoves[i]);
            value = Math.max(value, alphabeta(game, depth - 1, alpha, beta, false));
            alpha = Math.max(alpha, value);
            game.undo();
            if (beta <= alpha) {
                break;
            }
            // If search has taken longer than 30 seconds, cut it off.
            if (new Date().getTime() - moveStartTime > 30000) {
                break;
            }
        }
        
        // store board position in transposition table
        if (value <= alpha) {
            // a lowerbound value
            storeTranspositionTableEntry(getHashKey(game), "LOWERBOUND", depth, value);
        } else if (value >= beta) {
            // an upperbound value
            storeTranspositionTableEntry(getHashKey(game), "UPPERBOUND", depth, value);
        } else {
            // a true minimax value
            storeTranspositionTableEntry(getHashKey(game), "EXACT", depth, value);
        }
        return value;
    } else {
        value = INFINITY;
        for (j = 0; j < gameMoves.length; j += 1) {
            game.move(gameMoves[j]);
            value = Math.min(value, alphabeta(game, depth - 1, alpha, beta, true));
            beta = Math.min(beta, value);
            game.undo();
            if (beta <= alpha) {
                break;
            }
            // If search has taken more than 30 seconds, cut it off.
            if (new Date().getTime() - moveStartTime > 30000) {
                break;
            }
        }
        
        // store board position in transposition table
        if (value <= alpha) {
            // a lowerbound value
            storeTranspositionTableEntry(getHashKey(game), "LOWERBOUND", depth, value);
        } else if (value >= beta) {
            // an upperbound value
            storeTranspositionTableEntry(getHashKey(game), "UPPERBOUND", depth, value);
        } else {
            // a true minimax value
            storeTranspositionTableEntry(getHashKey(game), "EXACT", depth, value);
        }
        return value;
    }
}

// Root of the recursive function alphaBeta.
// Allows for the final value found to be converted into its corresponding game move.
function alphaBetaRoot(game, depth, maximizingPlayer) {
    "use strict";
    var gameMoves = game.moves(),
        bestMove = -INFINITY,
        bestMoveFound,
        gameMove,
        value,
        i;
    
    for (i = 0; i < gameMoves.length; i += 1) {
        gameMove = gameMoves[i];
        game.move(gameMove);
        value = alphabeta(game, depth - 1, -INFINITY, INFINITY, !maximizingPlayer, true);
        game.undo();
        if (value >= bestMove) {
            bestMove = value;
            bestMoveFound = gameMove;
        }
        //if Root search takes longer than 30 seconds, cut off search
        if (new Date().getTime() - moveStartTime > 30000) {
            break;
        }
    }
    return bestMoveFound;
}

// calls alphaBeta root to recursively go through game tree and find the best move
function getMove(game, depth) {
    "use strict";
    moveStartTime = new Date().getTime();
    var move,
        d;
    //Use iterative deepening and cut search off after 30 seconds
    for (d = 1; d <= depth; d += 1) {
        move = alphaBetaRoot(game, d, true);
        if (new Date().getTime() - moveStartTime > 30000) {
            break;
        }
    }
    return move;
}

// makes move found by get move after passing it the selcted depth chosen by the user
function makeMove() {
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
    // displays time taken for AI to find last move on webpage
    if (aiColor === 'b') {
        $('#blackMoveTime').text((new Date().getTime() - moveStartTime) / 1000 + " seconds");
    } else {
        $('#whiteMoveTime').text((new Date().getTime() - moveStartTime) / 1000 + " seconds");
    }
}

// allows AI color to be switched so other functions can check which color is the AI, and switch it if needed
function switchAIColor() {
    "use strict";
    if (aiColor === 'b') {
        aiColor = 'w';
    } else {
        aiColor = 'b';
    }
}

// switch the current AI color and have the new AI make a move
function switchAI() {
    "use strict";
    switchAIColor();
    makeMove();
}

// autoplays game of chess with 2 AI agents
function secondAIAgent() {
    "use strict";
    if (game.game_over() !== true) {
        switchAIColor();
        if (autoPlayBoolean === 1) {
            makeMove();
            board.position(game.fen());
            window.setTimeout(secondAIAgent, 250);
        }
    } else {
        checkGameStatus();
    }
}

//Board Visualization

// Only let user drag pieces if the game is still ongoing and they are trying to move a piece from the side whose turn it is
function onDragStart(source, piece) {
    "use strict";
    if (game.game_over() === true || (game.turn() === 'w' && piece.search(/^b/) !== -1) || (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

// Allows player to move pieces
function onDrop(source, target) {
    "use strict";
    // move piece to target position
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' //always promote pawn to queen
    });

    // Snap piece back to initial position if the move is illegal
    if (move === null) {
        return 'snapback';
    }
    
    updateFenPgn();
    
    // AI moves after human player moves piece
    if (game.in_checkmate() !== true && game.in_stalemate() !== true && game.in_draw() !== true) {
        window.setTimeout(makeMove, 250);
    }
}

// Updates the board position after the piece snap, sends current FEN to server, and checks if game is over
function onSnapEnd() {
    "use strict";
    board.position(game.fen());
    sendFEN();
    checkGameStatus();
}

// Configuration variables from chessboard.js frameworks
//
// configure of abilities the chessboard allows
// dragable: allows player to drag pieces
// position: where the pieces are located when board is initialized
// onDragStart: function telling board what to do when player drags a piece
// onDrop: function telling board what to do when player drops piece
// onSnapEnd: function telling board what to do when piece finishes snapping to new, or original square, after being dragged
var configuration = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};

board = new ChessBoard('board', configuration); //initialize board
updateFenPgn();
initTranspositionTable();
initZobristHashTable();

// Hides the end-of-game alerts so they are not always showing during the game. 
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

// Buttons on webpage

// Only works when game is not autoplaying
function autoPlay() {
    "use strict";
	if (autoPlayBoolean !== 1) {
        autoPlayBoolean = 1;
        secondAIAgent();
	}
}

// Only works when game is autoplaying
function stopAutoPlay() {
    "use strict";
    if (autoPlayBoolean === 1) {
        autoPlayBoolean = 0;
        switchAIColor(); //necessary so the aiColor is still correct/not out of synce
    }
}

// Only works when game is not autoplaying
function switchAIButton() {
    "use strict";
    if (autoPlayBoolean === 0) {
        switchAI();
    }
}

// Only works when game is not autoplaying
function undoMove() {
    "use strict";
    if (autoPlayBoolean === 0) {
        game.undo();
        updateFenPgn();
        board.position(game.fen());
    }
}

// Flips the orientation of the chessboard.
// Only works when game is not autoplaying
function flipBoard() {
    "use strict";
    if (autoPlayBoolean === 0) {
        board.flip();
    }
}

// resets the chess game to the start position.
// re-initializes the board position, aiColor to black, and the zobrist/transposition tables.
// Only works when game is not autoplaying
function reset() {
    "use strict";
    if (autoPlayBoolean === 0) {
        game.reset();
        board.position(game.fen());
        aiColor = 'b'; //resets aiColor black, which is the ;laskdjf for the beginning of the game
        updateFenPgn();
        initZobristHashTable();
        initTranspositionTable(); //Clears transposition table for the new game
    }
}

//give buttons their functionality
$('#secondAIBtn').on('click', autoPlay);
$('#stopAutoBtn').on('click', stopAutoPlay);
$('#switchAIBtn').on('click', switchAIButton);
$('#undoMoveBtn').on('click', undoMove);
$('#flipOrientationBtn').on('click', flipBoard);
$('#resetBtn').on('click', reset);