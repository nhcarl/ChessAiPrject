#! /usr/bin/python2.7

import cgi
import cgitb

cgitb.enable()

input = cgi.FieldStorage()

if "pgn" in input:
	pgn = input["pgn"].value
	text_file = open("pgn.txt", "a")
	text_file.write("PGN: " + pgn + "\n\n")
	print "Content-Type: application/python\n"
	print("PGN Added")

if "fen" in input:
	fen = input["fen"].value
	text_file = open("fen.txt", "a")
	text_file.write("FEN: " + fen + "\n\n")
	print "Content-Type: application/python\n"
	print("FEN Added")

print "Content-Type: application/python\n"
print("End")
