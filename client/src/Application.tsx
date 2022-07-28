import React from 'react';
import VideoUpload from './VideoUpload';
import styles from './Application.css';

export default function Application() {
	return (
		<div className={styles.root}>
			<h1>Phillip (Ephraim) Cheron's 70th Birthday is approaching!</h1>
			<p>
				Please record your birthday wishes. All the videos will get
				assembled into a video to present at his 70th Birthday Party!
			</p>
			<p>
				When you press 'Start Camera', your browser will ask for
				permission to use your camera. You can then press 'Start
				Recording' to record a 15 second message.
			</p>
			<VideoUpload />
		</div>
	);
}
