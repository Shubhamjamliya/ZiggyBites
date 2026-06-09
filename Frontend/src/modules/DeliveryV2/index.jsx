import DeliveryV2Router from './DeliveryV2Router';
import './deliveryTheme.css';
import { useEffect, useState } from 'react';
import { loadAppCustomization, normalizeThemeColor } from '@food/utils/appCustomization';

function DeliveryV2Module() {
	const [themeColor, setThemeColor] = useState("#15498b");

	useEffect(() => {
		let isMounted = true;

		loadAppCustomization()
			.then((settings) => {
				if (!isMounted) return;
				const color = normalizeThemeColor(settings?.theme?.primaryColor, "#15498b");
				setThemeColor(color);
			})
			.catch(() => {
				// Keep delivery theme fallback if customization fetch fails.
			});

		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<div
			className="delivery-v2-theme"
			style={{ "--dv-primary": themeColor }}
		>
			<DeliveryV2Router />
		</div>
	);
}

export default DeliveryV2Module;
