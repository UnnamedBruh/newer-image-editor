(function() {
	const leftEmboss = document.createElement("option");
	leftEmboss.value = "emb";
	leftEmboss.textContent = "Emboss";

	function emboss(len, imageData, currentImageData, x) {
		if (effectParams[0].value == 0) return;
		const imgD = new ImageData(new Uint8ClampedArray(len), currentImageData.width, currentImageData.height);
		const data = imgD.data;
		const perc = +effectParams[0].value / 100;
		let i = 4;

		for (; i < len;) {
			data[i] = interpolate(imageData[i], imageData[i] - imageData[i - 4], perc); i++;
			data[i] = interpolate(imageData[i], imageData[i] - imageData[i - 4], perc); i++;
			data[i] = interpolate(imageData[i], imageData[i] - imageData[i - 4], perc); i++;
			data[i] = imageData[i]; i++;
		}
		x(imgD);
	}

	customModdedEffects.push(["emb", "<a>Progress (as a percentage):</a><input type=\"number\" value=\"100\" step=\"0.390625\" min=\"0\" max=\"100\" id=\"e-invpro\">%", function() {
		return [document.getElementById("e-invpro")];
	}, emboss]);

	effects.appendChild(leftEmboss);
})();
