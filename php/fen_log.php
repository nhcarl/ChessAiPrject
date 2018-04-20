<?php
	$file = fopen("/usr/lib/cgi-bin/fen.txt","r");
	while(! feof($file)) {
		echo fgets($file). "<br />";
	}
	fclose($file);
?> 