<?php
	$file = fopen("/usr/lib/cgi-bin/pgn.txt","r");
	while(! feof($file)) {
		echo fgets($file). "<br />";
	}
	fclose($file);
?> 
