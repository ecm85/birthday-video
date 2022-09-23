$download = $True
$makeMp4 = $True
$doFfprobe = $True


$bucket = "s3://birthday-video-uploads"
$outputDirectory = "c:\delete\birthday-videos"
pushd $outputDirectory
$s3Listings = & aws s3 ls $bucket | Sort-Object { (-split $_)[1] } | Sort-Object { (-split $_)[0] }
echo "s3 Listings:"
echo $s3Listings
$outputFileNames = @()
foreach ($s3Listing in $s3Listings) {
	$s3ListingFileName = (-split $s3Listing)[3]
	$outputFileName = $s3ListingFileName.Replace(':', '-')
	$outputFileNames += $outputFileName
	if ($download -eq $True) {
		& aws s3 cp "$bucket/$s3ListingFileName" "$outputDirectory\$outputFileName"
	}
}
echo "output file names:"
echo $outputFileNames

if ($makeMp4 -eq $True) {
	foreach($outputFileName in $outputFileNames) {
		Invoke-Expression "ffprobe $outputFileName" -ErrorVariable ffProbeOutput 2>&1>$null
		$inputLine = $ffProbeOutput.Where({ $_ -Match "Input #0"})[0]
		if($inputLine -Match ("Input #0, mov,mp4,m4a,3gp,3g2,mj2, from") -eq $True) {
			Rename-Item -Path $outputFileName -NewName "$outputFileName.mp4"
		} elseif($inputLine -Match ("Input #0, matroska,webm, from") -eq $True) {
			ffmpeg -i $outputFileName "$outputFileName.mp4"
			Move-Item $outputFileName ".\preconvert\$outputFileName"
		} else {
			echo "Unknown file format"
		}
	}
}


if ($doFfprobe -eq $True) {
	$ffprobe_output = "$outputDirectory\ffprobe_output.txt"
	echo "" > $ffprobe_output
	foreach($outputFileName in $outputFileNames) {
		& ffprobe "$outputDirectory\$outputFileName.mp4" >> $ffprobe_output 2>&1
	}
}

$outputFileMp4s = $outputFileNames | %{"file $_.mp4"}

[IO.File]::WriteAllLines("$outputDirectory\allFiles.txt", $outputFileMp4s)

$parameters = @()
$initialFilter = ""
$secondaryFilter = ""

for($counter=0; $counter -lt $outputFileNames.length; $counter++) {
	$outputFileName = $outputFileNames[$counter]
	$parameters += "-i"
	$parameters += "$outputFileName.mp4"
	$initialFilter += "[$($counter):v]scale=1024:768:force_original_aspect_ratio=decrease,pad=1024:768:-1:-1,setsar=1,fps=30,format=yuv420p[v$counter]; "
	$secondaryFilter += "[v$counter][$($counter):a]"
}

$otherParameters = ("-filter_complex", "`"$initialFilter$($secondaryFilter)concat=n=$($outputFileNames.length):v=1:a=1[v][a]`"", "-map", "`"[v]`"", "-map", "`"[a]`"", "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", "output.mp4")
$parameters += $otherParameters

# echo "ffmpeg $parameters-filter_complex ""$initialFilter$secondaryFilter concat=n=$($outputFileNames.length):v=1:a=1[v][a]"" -map ""[v]"" -map ""[a]"" -c:v libx264 -c:a aac -movflags +faststart output.mp4"
# & ffmpeg $parameters-filter_complex """$initialFilter$secondaryFilter concat=n=$($outputFileNames.length):v=1:a=1[v][a]""" -map """[v]""" -map """[a]""" -c:v libx264 -c:a aac -movflags +faststart output.mp4
# & C:\Users\ezram\source\repos\ArgumentEcho\ArgumentEcho\bin\Release\net5.0\publish\ArgumentEcho.exe $parameters
& ffmpeg $parameters
# echo $parameters
popd

