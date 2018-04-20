#! /usr/bin/python2.7

import cgi
import cgitb

cgitb.enable()

input = cgi.FieldStorage()

if "fen" in input:
	fen = input["fen"].value
	text_file = open("fen.txt", "a")
	text_file.write("FEN: " + fen + "\n\n")
	print "Content-Type: application/python\n"
	print("FEN Added")

if "start" in input:
	start = input["start"].value
	text_file = open("fen.txt", "a")
	text_file.write(start + ":\n\n")
	print "Content-Type: application/python\n"
	print("Start Added")

print "Content-Type: application/python\n"
print("End")
