import React, { useRef, useState, useEffect } from 'react';
import styles from './VideoUpload.css';
import cx from 'classnames';
import Timer from './Timer';

// TODO:
// add 'done recording' video button?
// switch to modal?
// presigned s3 url?
// hide video elements

enum IWorkflowState {
	Initial,
	CameraStarting,
	CameraStarted,
	CountdownToRecording,
	Recording,
	Recorded,
	Uploading,
	Done,
	Error
}

export default function VideoUpload() {
	const canvasRef = useRef<HTMLCanvasElement>();
	const captureVideoRef = useRef<HTMLVideoElement>();
	const playbackVideoRef = useRef<HTMLVideoElement>();
	const [state, setState] = useState(IWorkflowState.Initial);
	const [mediaStream, setMediaStream] = useState<MediaStream>(null);
	const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder>();
	const [blob, setBlob] = useState<Blob>();

	const startSpecificCameraFromStream = async (stream: MediaStream) => {
		try {
			captureVideoRef.current.srcObject = stream;
			setMediaStream(stream);
			return true;
		} catch (error) {
			console.info(
				`unable to start camera: ${stream.id} - ${error.message}`
			);
			return false;
		}
	};

	const startSpecificCameraByEnsuringAccess = async () => {
		try {
			const initialCamera = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: { facingMode: { ideal: 'user' } }
			});
			return await startSpecificCameraFromStream(initialCamera);
		} catch (error) {
			console.info(`unable to get camera: ${error.message}`);
			return false;
		}
	};

	const getCameraInfos = async () => {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter(device => device.kind === 'videoinput');
	};

	const cameraIsBack = (cameraInfo: MediaDeviceInfo) => {
		return (cameraInfo.label || '').toLowerCase().includes('back');
	};

	const orderCameraInfos = (camerasInfos: MediaDeviceInfo[]) => {
		return [...camerasInfos].sort((cameraInfo1, cameraInfo2) => {
			const camera1IsBack = cameraIsBack(cameraInfo1);
			const camera2IsBack = cameraIsBack(cameraInfo2);

			if (camera1IsBack && !camera2IsBack) {
				return 1;
			}
			if (camera2IsBack && !camera1IsBack) {
				return -1;
			}

			return 0;
		});
	};

	const startSpecificCameraFromInfo = async (cameraInfo: MediaDeviceInfo) => {
		try {
			const camera = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: { deviceId: { exact: cameraInfo.deviceId } }
			});
			return await startSpecificCameraFromStream(camera);
		} catch (error) {
			console.info(
				`unable to get camera: ${cameraInfo.label} - ${error.message}`
			);
			return false;
		}
	};

	const startPreferredCameraAsync = async () => {
		try {
			if (await startSpecificCameraByEnsuringAccess()) {
				return true;
			}
			const cameraInfos = await getCameraInfos();
			const orderedCameraInfos = orderCameraInfos(cameraInfos);
			for (const cameraInfo of orderedCameraInfos) {
				if (await startSpecificCameraFromInfo(cameraInfo)) {
					return true;
				}
			}
			return false;
		} catch (error) {
			console.info(`unable to access camera: ${error.message}`);
			return false;
		}
	};

	useEffect(() => {
		if (
			captureVideoRef.current &&
			state === IWorkflowState.CameraStarting
		) {
			const startPreferredCamera = async () => {
				const startedCamera = await startPreferredCameraAsync();
				if (startedCamera) {
					setState(IWorkflowState.CameraStarted);
				} else {
					setState(IWorkflowState.Error);
				}
			};
			startPreferredCamera().catch(() => setState(IWorkflowState.Error));
		}
		// TODO: Handle cancellation?
	}, [captureVideoRef.current, state]);

	useEffect(() => {
		if (state !== IWorkflowState.Uploading) {
			return;
		}
		const dateFileName = `birthday_video_${new Date().toJSON()}`;
		const uploadFile = async () => {
			const s3Url = `https://birthday-video-uploads.s3.amazonaws.com/${dateFileName}`;
			const response = await fetch(s3Url, {
				method: 'PUT',
				body: blob
			});
			if (!response?.ok) {
				setState(IWorkflowState.Error);
			} else {
				setState(IWorkflowState.Done);
			}
		};
		uploadFile().catch(() => setState(IWorkflowState.Error));
	}, [state]);

	const handleStartCameraClicked = () => {
		setState(IWorkflowState.CameraStarting);
	};

	const handleStartRecordingClicked = () => {
		setState(IWorkflowState.CountdownToRecording);
	};

	const handleCountdownDone = () => {
		setState(IWorkflowState.Recording);
		const newMediaRecorder = new MediaRecorder(mediaStream);
		newMediaRecorder.ondataavailable = (event: BlobEvent) => {
			const newBlob = event.data;
			const newBlobUrl = URL.createObjectURL(newBlob);
			playbackVideoRef.current.src = newBlobUrl;
			setBlob(newBlob);
			setState(IWorkflowState.Recorded);
		};
		setMediaRecorder(newMediaRecorder);
		newMediaRecorder.start();
	};

	const playbackVideoClassName = cx(styles.video, {
		[styles.hiddenVideo]: state !== IWorkflowState.Recorded
	});

	const captureVideoClassName = cx(styles.video, {
		[styles.hiddenVideo]:
			state !== IWorkflowState.Recording &&
			state !== IWorkflowState.CameraStarted &&
			state !== IWorkflowState.CountdownToRecording
	});

	const handleRecordingDone = () => {
		mediaRecorder.stop();
	};

	const handleAcceptRecordingClicked = () => {
		setState(IWorkflowState.Uploading);
	};

	return (
		<div>
			<div>
				{state === IWorkflowState.Initial && (
					<button onClick={handleStartCameraClicked}>
						Start Camera
					</button>
				)}
				{state === IWorkflowState.CameraStarted && (
					<button onClick={handleStartRecordingClicked}>
						Start Recording
					</button>
				)}
				{(state === IWorkflowState.Recorded ||
					state === IWorkflowState.Uploading) && (
					<>
						<button
							onClick={handleStartRecordingClicked}
							disabled={state === IWorkflowState.Uploading}>
							Re-do Recording
						</button>
						<button
							onClick={handleAcceptRecordingClicked}
							disabled={state === IWorkflowState.Uploading}>
							{state === IWorkflowState.Recorded ? (
								<>Accept Recording</>
							) : (
								<>Uploading...</>
							)}
						</button>
					</>
				)}
				{(state === IWorkflowState.CameraStarting ||
					state === IWorkflowState.CountdownToRecording ||
					state === IWorkflowState.Recording) && (
					<button className={styles.placeholderButton}>
						Placeholder
					</button>
				)}
			</div>
			<canvas hidden ref={canvasRef}></canvas>
			{state === IWorkflowState.CameraStarting && (
				<div>Waiting for camera to start...</div>
			)}
			<div className={styles.captureWrapper}>
				<video
					playsInline
					className={captureVideoClassName}
					autoPlay
					muted
					ref={captureVideoRef}></video>
				<div className={styles.countdownWrapper}>
					{state === IWorkflowState.CountdownToRecording && (
						<Timer
							seconds={5}
							onComplete={handleCountdownDone}
							className={styles.countdownTimer}
						/>
					)}
				</div>
			</div>
			<div className={styles.recordingTimerWrapper}>
				{state === IWorkflowState.Recording && (
					<>
						Time Remaining:
						<Timer
							seconds={15}
							onComplete={handleRecordingDone}
							className={styles.recordingTimer}
						/>
					</>
				)}
			</div>
			<div className={styles.playbackWrapper}>
				{state === IWorkflowState.Recorded && <div>Preview:</div>}
				<video
					playsInline
					controls
					className={playbackVideoClassName}
					ref={playbackVideoRef}></video>
			</div>
			{state === IWorkflowState.Done && (
				<div>Thanks! Your video has been uploaded.</div>
			)}
			{state === IWorkflowState.Error && (
				<div>Uh Oh! Something went wrong.</div>
			)}
		</div>
	);
}
