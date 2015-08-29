<?php
//TODO: Turn off data emit
function CallAPI($method, $url, $data = false)
{
    $curl = curl_init();

    switch ($method)
    {
        case "POST":
            curl_setopt($curl, CURLOPT_POST, 1);

            if ($data)
                curl_setopt($curl, CURLOPT_POSTFIELDS, $data);
            break;
    }

    curl_setopt($curl, CURLOPT_URL, $url);

    $result = curl_exec($curl);
     curl_close($curl);

    return $result;
}

# TODO: Determine whether a http header response is better.
function exitWithSuccess() {
    echo "\nSUCCESS OUT\n";
    exit("SUCCESS");
}

function exitWithError($errorText) {
    echo "\nERROR OUT\n";
    exit("ERROR:" . $errorText);
}

$json = file_get_contents('php://input');
$obj = json_decode($json, TRUE);

$method = $obj["endpoint"]["method"];

# TODO: Better error checking and actual data validity testing.
if (!$method) {
    exitWithError("No endpoint/method data in POST.");
}

# SOAP Server pukes with &. Go figure.
$url = $obj["endpoint"]["url"];
$url = str_replace('&', '[AMPERSAND]', $url);
$url = '"' . $url . '"';

foreach($obj['data'] as $array) {
   $body = "message=" . $method . "|" . $url . "|" . $array['key'] . "|" . $array['value'];
    CallAPI("POST", "http://127.0.0.1:8101/messages/attr-queue", $body);
}
exitWithSuccess();
?>