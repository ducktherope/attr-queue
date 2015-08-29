Kochava Miniproject :: "Postback Delivery"
architectural design:https://drive.google.com/file/d/0B3awEXtqW5_7NW5FeVV3cmx3Wlk/view
git repo: https://github.com/travisj/attr-queue.git

Overview:
A php application to ingest http requests, and node.js application to deliver 
postback responses. Uses Redis to host a job queue between them. Key/value pairs 
are translated in http POST/GET response forwards. RSMQ node libraray is used 
to do queue management. RMSQ REST is used to provide SOAP interface to nginx
PHP process for injestion. Queues are set in the attr-queue-config.json file. 
Defaults are:
attr-queue - Attribute transfer queue between PHP and Node.js.
attr-log-queue - Queue of application run time events.
attr-error-queue - Queue to log each failed message with all message details.
attr-stat-queue - Not yet implemented.

To run test:
curl -d @testdata.json -H "Content-Type: application/json" http://127.0.0.1/injest.php
curl -d @testlocaldata.json -H "Content-Type: application/json" http://127.0.0.1/injest.php

How to setup server:
Create application directory
	mkdir /usr/attr-queue
	chmod 777 /usr/attr-queue
	cd /usr/attr-queue
	Copy all files from /delivery to /usr/attr-queue

Install redis
	sudo apt-get install redis-server
	copy redis_6379_init.sh /etc/initd
	sudo update-rc.d redis_6379_init.sh defaults

Install web server and PHP
	Install NGINX from: https://www.digitalocean.com/community/tutorials/how-to-install-linux-nginx-mysql-php-lemp-stack-on-ubuntu-12-04
	sudo apt-get install nginx
	sudo apt-get install php5-fpm
	sudo apt-get install php5-cli
	sudo nano /etc/php5/fpm/php.ini
	change cgi.fix_pathinfo=1 to 0
	sudo service php5-fpm restart
	test nginx : http://45.55.41.115/
	sudo nano /etc/nginx/sites-available/default
	from: http://stackoverflow.com/questions/25591040/nginx-serves-php-files-as-downloads-instead-of-executing-them
	  // need to uncomment the error sections
	  // need to set the root path to the requestAgent folder
	  // add index.php to the index line
	  // uncomment only the last three lines of the location block
		  location ~ \.php$ {
								# fastcgi_split_path_info ^(.+\.php)(/.+)$;
								# # NOTE: You should have "cgi.fix_pathinfo = 0;" in php.ini
								#
								# # With php5-cgi alone:
								# fastcgi_pass 127.0.0.1:9000;
								# With php5-fpm:
								fastcgi_pass unix:/var/run/php5-fpm.sock;
								fastcgi_index index.php;
								include fastcgi_params;
								}
	sudo nano /usr/share/nginx/html/info.php
		add the following and save the file:
			<?php
				phpinfo();
			?>
	sudo service nginx restart
	test the php page: http://<server IP>/info.php
	Copy /injestion/injest.php to /usr/share/nginx/html		

Install nodejs
	sudo apt-get install nodejs
Install rsmq and related libs
	npm install rsmq -g
	npm install rsmq-worker -g
	npm install rest-rsmq -g
	npm install stathat -g --save
	npm install request -g
	npm install forever -g
	npm install forever-service -g
	
Configure node jobs to run automatically
	sudo forever-service install soapserver --script /usr/attr-queue/node_modeuls/rest-rsmq/server.js
	sudo forever-service install attr-queue --script /usr/attr-queue/attr-queue.js
