import React from 'react';
import VideoUpload from './VideoUpload';

export default function Application() {
	return (
		<div>
			<h1>Phillip (Ephraim) Cheron's 70th Birthday is approaching!</h1>
			<div>
				Please record your birthday wishes. All the videos will get
				assembled into a video to present at his 70th Birthday Party!
			</div>
			<VideoUpload />
		</div>
	);
}
