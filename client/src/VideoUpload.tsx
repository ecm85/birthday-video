import React, { useRef, useState, useEffect } from 'react';
import styles from './VideoUpload.css';

export default function VideoUpload() {
	const canvasRef = useRef<HTMLCanvasElement>();
	const videoRef = useRef<HTMLVideoElement>();
	const [isCameraStarted, setIsCameraStarted] = useState(false);
	// const [mediaStream, setMediaStream] = useState<MediaStream>(null);

	const startSpecificCameraFromStream = async (stream: MediaStream) => {
		try {
			videoRef.current.srcObject = stream;
			// setMediaStream(stream);
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
				audio: false,
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
				return -1;
			}
			if (camera2IsBack && !camera1IsBack) {
				return 1;
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
		if (videoRef.current) {
			const startPreferredCamera = async () => {
				const startedCamera = await startPreferredCameraAsync();
				if (startedCamera) setIsCameraStarted(startedCamera);
				else {
					// TODO: Handle failure here?
				}
			};
			startPreferredCamera().catch(console.error);
		}
		// TODO: Handle cancellation?
	}, []);

	return (
		<div>
			<canvas hidden ref={canvasRef}></canvas>
			{!isCameraStarted && <div>Waiting for camera to start...</div>}
			<video
				playsInline
				className={styles.video}
				autoPlay
				ref={videoRef}></video>
		</div>
	);
}
