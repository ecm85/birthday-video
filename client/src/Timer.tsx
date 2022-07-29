import React, { useState, useEffect } from 'react';

export interface ITimerProps {
	seconds: number;
	onComplete(): void;
	className?: string;
}

export default function Timer({ seconds, onComplete, className }: ITimerProps) {
	const [value, setValue] = useState(seconds);
	useEffect(() => {
		const interval = setTimeout(() => {
			const newValue = value - 1;
			setValue(newValue);
			if (newValue === 0) {
				onComplete();
			}
		}, 1000);
		return () => {
			clearTimeout(interval);
		};
	}, [value]);
	return <div className={className}>{value}</div>;
}
